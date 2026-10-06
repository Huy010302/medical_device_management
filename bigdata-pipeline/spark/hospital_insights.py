"""Spark business analytics over actual PostgreSQL workflow snapshots.

Risk is an operational prioritization heuristic (0–100), not a medical safety rating.
"""
from pathlib import Path
from pyspark.sql import functions as F
from pyspark.sql.types import StructType, StructField, StringType, ArrayType

FIELDS = {
 'devices': ['id','device_code','name','department_id','installation_date'],
 'maintenance_records': ['id','device_id','cost','actual_date'],
 'repair_records': ['id','device_id','total_cost','report_date','repair_end_date','fault_category'],
 'replacement_parts': ['id','repair_record_id','quantity','unit_price'],
 'purchase_records': ['id','device_id','total_value'],
 'reception_records': ['id','device_id'],
 'departments': ['id','name'],
}
def read_rows(spark,root,kind):
    schema=StructType([StructField(name,ArrayType(StringType()) if name=='device_ids' else StringType()) for name in FIELDS[kind]+(['device_ids'] if kind=='purchase_records' else [])])
    path=root/(kind+'.jsonl')
    if not path.is_file(): raise FileNotFoundError(f'Missing {path}; run export_events.py')
    if not path.stat().st_size: return spark.createDataFrame([],schema)
    return spark.read.schema(schema).json(str(path))

def money(column): return F.coalesce(F.col(column).cast('double'),F.lit(0.0))
def count_if(condition): return F.sum(F.when(condition,1).otherwise(0))
def hospital_outputs(spark,root:Path):
    d,m,r,parts,purchases,_,department_rows=[read_rows(spark,root,k) for k in FIELDS]
    devices=d.select(F.col('id').alias('device_id'),F.col('device_code'),F.col('name').alias('device_name'),F.col('department_id'),F.to_date('installation_date').alias('installation_date')).where(F.col('device_id').isNotNull())
    maintenance=m.select('device_id',money('cost').alias('cost')).where(F.col('device_id').isNotNull())
    repairs=r.select(F.col('id').alias('repair_id'),'device_id',money('total_cost').alias('cost'),F.to_date('report_date').alias('date'),F.to_date('repair_end_date').alias('end_date'),'fault_category').where(F.col('device_id').isNotNull())
    ma=maintenance.groupBy('device_id').agg(F.sum('cost').alias('maintenance_cost'))
    ra=repairs.groupBy('device_id').agg(F.sum('cost').alias('repair_cost'),F.count('*').alias('repair_count'),count_if(F.col('date')>=F.date_sub(F.current_date(),365)).alias('repairs_365d'),F.sum(F.when(F.col('end_date').isNotNull() & F.col('date').isNotNull(),F.greatest(F.datediff('end_date','date'),F.lit(0))).otherwise(0)).alias('downtime_days'))
    part_totals=parts.select('repair_record_id',(money('quantity')*money('unit_price')).alias('part_cost')).join(repairs.select('repair_id','device_id'),F.col('repair_record_id')==F.col('repair_id'),'inner').groupBy('device_id').agg(F.sum('part_cost').alias('replacement_part_cost'))
    # Allocate a shared contract evenly over explicitly linked device IDs only.
    purchase_ids=purchases.withColumn('ids',F.when(F.size('device_ids')>0,F.col('device_ids')).otherwise(F.array('device_id')))
    allocated=purchase_ids.withColumn('allocation',money('total_value')/F.size('ids')).withColumn('device_id',F.explode('ids')).where(F.col('device_id').isNotNull() & (F.col('device_id')!='')).groupBy('device_id').agg(F.sum('allocation').alias('purchase_cost'))
    base=devices.join(ma,'device_id','left').join(ra,'device_id','left').join(part_totals,'device_id','left').join(allocated,'device_id','left').fillna(0,subset=['purchase_cost','maintenance_cost','repair_cost','replacement_part_cost','repair_count','repairs_365d','downtime_days'])
    cost=base.select('device_id','device_code','department_id','purchase_cost','maintenance_cost','repair_cost','replacement_part_cost',(F.col('purchase_cost')+F.col('maintenance_cost')+F.col('repair_cost')+F.col('replacement_part_cost')).alias('total_lifecycle_cost'))
    age_years=F.when(F.col('installation_date').isNotNull(),F.greatest(F.datediff(F.current_date(),'installation_date'),F.lit(0))/F.lit(365.25)).otherwise(0)
    # Each component is capped at its stated weight. Missing age or price contributes zero.
    cost_ratio=F.when(F.col('purchase_cost')>0,F.col('repair_cost')/F.col('purchase_cost')).otherwise(0)
    failure_component=F.least(F.lit(40.0),F.col('repairs_365d')*10.0)
    downtime_component=F.least(F.lit(30.0),F.col('downtime_days')*1.0)
    cost_component=F.least(F.lit(20.0),cost_ratio*40.0)
    age_component=F.least(F.lit(10.0),age_years)
    score=F.round(failure_component+downtime_component+cost_component+age_component,0).cast('int')
    risk=base.withColumn('risk_score',score).withColumn('risk_level',F.when(score>=70,'HIGH').when(score>=40,'MEDIUM').otherwise('LOW')).withColumn('reason',F.concat_ws('; ',F.when(F.col('repairs_365d')>=2,F.lit('Frequent repairs in last 365 days')),F.when(F.col('downtime_days')>=7,F.lit('Extended repair downtime')),F.when(cost_ratio>=0.25,F.lit('Repair cost high relative to purchase')),F.when(age_years>=7,F.lit('Older equipment')))).select('device_id','device_code','risk_score','risk_level','reason','repairs_365d','downtime_days')
    failures=repairs.withColumn('fault_category',F.coalesce(F.col('fault_category'),F.lit('Unclassified'))).groupBy('fault_category').agg(F.count('*').alias('repair_count')).orderBy(F.desc('repair_count'))
    frequent=repairs.groupBy('device_id').agg(F.count('*').alias('repair_count')).join(devices.select('device_id','device_code','device_name','department_id'),'device_id').orderBy(F.desc('repair_count'))
    names=department_rows.select(F.col('id').alias('department_id'),F.col('name').alias('department_name'))
    departments=repairs.join(devices.select('device_id','department_id'),'device_id').groupBy('department_id').agg(F.count('*').alias('repair_count'),F.sum('cost').alias('repair_cost')).join(names,'department_id','left').orderBy(F.desc('repair_count'))
    maintenance_dept=maintenance.join(devices.select('device_id','department_id'),'device_id').groupBy('department_id').agg(F.sum('cost').alias('maintenance_cost')).join(names,'department_id','left').orderBy(F.desc('maintenance_cost'))
    return {'device_risk_score':risk,'device_lifecycle_cost':cost,'failure_categories':failures,'failure_devices':frequent,'failure_departments':departments,'maintenance_departments':maintenance_dept}
