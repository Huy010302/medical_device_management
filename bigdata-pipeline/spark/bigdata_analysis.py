from lifecycle_analysis import lifecycle_outputs
from maintenance_analysis import maintenance_outputs
from repair_analysis import repair_outputs
from advanced_analysis import advanced_outputs


def build_outputs(events):
    outputs = {}
    outputs.update(lifecycle_outputs(events))
    outputs.update(maintenance_outputs(events))
    outputs.update(repair_outputs(events))
    outputs.update(advanced_outputs(events))
    return outputs
