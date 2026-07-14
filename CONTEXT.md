# MetricYak

MetricYak turns a stream of raw events into declared metrics, watches those metrics with monitors, and routes anomalies into investigation workflows. This glossary fixes the language for that flow so the same words mean the same thing in code, tests, and conversation.

## The core flow

**Event**:
A single raw fact ingested into a project — a name, a timestamp, and a bag of properties. The unqualified input to everything else.
_Avoid_: message, record, datapoint

**Metric**:
A declared aggregation over matching events (count, sum, average, min, max), optionally combined by an expression and split by dimensions. A metric is versioned — each definition is a distinct, numbered version.
_Avoid_: measure, KPI, stat

**Monitor**:
A rule that watches one metric and fires when its value crosses a threshold condition, held for a duration. Owns its own scope, window, hold-for, and missing-data behaviour.
_Avoid_: alert (that's what a monitor *emits*), alarm, check

**Workflow**:
Where a firing monitor is meant to route — an investigation or automation (Slack, email, …), the final stage of the flow.
_Avoid_: action, notification, hook

## Aggregation

**Ingest**:
The process that turns a batch of events into bucket deltas: match events to metrics, admit dimension values, and accumulate the deltas. The write side of the flow.
_Avoid_: processing, consuming, handling

**Bucket**:
One aggregate cell for a metric at a granularity, keyed by metric version, granularity, bucket start, series, dimension name, and dimension value. Deltas merge into buckets; buckets are read back over a window.
_Avoid_: bin, cell, slot

**Granularity**:
The time resolution of a bucket. Only `minute` is materialised today.
_Avoid_: resolution, interval, grain

**Series**:
One named event within a multi-event metric (the `seriesKey`). An expression combines series into a metric value.
_Avoid_: term, component, stream

**Window**:
A `[from, to)` time range over which a metric value or breakdown is computed from buckets.
_Avoid_: range, period, span

**Dimension**:
A property a metric can be broken down by (e.g. `country`). Each dimension has a bounded set of admitted values per metric version.
_Avoid_: facet, attribute, group-by

**`$total`**:
The sentinel dimension value standing for the whole metric, unsplit — the aggregate across all dimension values.
_Avoid_: all, overall, aggregate

**`$other`**:
The sentinel dimension value that unadmitted dimension values fold into once a metric version has reached its dimension cardinality cap.
_Avoid_: misc, overflow, rest

**Cardinality cap**:
The maximum number of distinct values admitted for a dimension on a metric version. Values arriving beyond the cap resolve to `$other`.
_Avoid_: limit, quota, ceiling

## Reads

**Value**:
A metric's scalar result over a window, optionally split by one dimension.
_Avoid_: result, total, output

**Breakdown**:
Per-dimension-value change between two windows — the current and comparison values, their delta, and each value's contribution to the total delta.
_Avoid_: comparison, diff, split

**Mover**:
A single dimension value in a breakdown, ranked by the absolute size of its delta. "Top movers" are the largest contributors to a metric's change.
_Avoid_: driver, contributor, factor
