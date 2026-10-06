from pathlib import Path
import shutil

def write_single_csv(df, output_file: Path):
    """Write a Spark DataFrame as one exact CSV filename, atomically enough for demo use."""
    output_file.parent.mkdir(parents=True, exist_ok=True)
    tmp_dir = output_file.parent / (output_file.stem + ".__spark_tmp__")
    if tmp_dir.exists():
        shutil.rmtree(tmp_dir)

    df.coalesce(1).write.mode("overwrite").option("header", True).csv(str(tmp_dir))
    parts = list(tmp_dir.glob("part-*.csv"))
    if not parts:
        raise RuntimeError(f"Spark did not create a CSV part for {output_file.name}")

    tmp_file = output_file.with_suffix(output_file.suffix + ".tmp")
    if tmp_file.exists():
        tmp_file.unlink()
    shutil.move(str(parts[0]), str(tmp_file))
    tmp_file.replace(output_file)
    shutil.rmtree(tmp_dir, ignore_errors=True)

def export_all(outputs: dict, output_dir: Path):
    for name, df in outputs.items():
        write_single_csv(df, output_dir / f"{name}.csv")
