# Product

## Register

product

## Users

Two equally active audiences who share the same workflows:

- **Business users**: define the metrics the business cares about, map them to the underlying events, configure where anomalies should route (Slack, email, etc.), and check in to understand what's changing and why.
- **Engineers**: set up and connect instrumentation, validate that the right events are flowing, and use monitors to catch technical regressions alongside business signals.

Both audiences build, configure, and monitor — neither is just a viewer. A product manager should be able to define a metric and wire up a monitor without engineering help. An engineer should be able to validate event pipelines without switching tools.

## Product Purpose

MetricYak is a metrics observability and monitoring platform built around one core flow: **event → metric → monitor → investigation/workflow**. Users define which events to track, turn them into metrics, create monitors that fire when something changes, and route alerts into investigation workflows (Slack, etc.).

This flow must feel like one connected journey, not four separate modules. Alongside setup, users get live observability: a stream of incoming events, current metric values, and monitor states — all visible without needing to build a separate dashboard.

Success looks like: any user — technical or not — can take a business question ("is this metric dropping?"), wire it up end-to-end, and get notified in the right place in minutes, not an afternoon.

## Brand Personality

Clear, quirky, friendly. Warm and approachable without being frivolous, with genuine character in copy and empty states, but the data surfaces stay clean and honest. The quirk lives in the margins — loading states, empty states, microcopy, transitions — not on top of the metrics.

## Anti-references

- **Datadog / Splunk**: Dense, enterprise-grade overwhelm. Wall-to-wall charts, aggressive blue/purple palettes, UI that feels like it requires a 3-day onboarding just to configure an alert.
- **Generic SaaS (Notion, Monday.com)**: Soft collaboration-tool energy — pastels, friendly illustrations everywhere. Doesn't feel like a serious analytics product people trust with production data.
- **Grafana OSS**: Configuration-panel-first. Every feature exposed at once, low visual polish, functional over intentional. Feels assembled, not designed.
- **Corporate BI (Tableau, Power BI)**: Formal and heavy. Built for quarterly presentations, not daily monitoring.

## Design Principles

1. **Signal over chrome** — every UI element must justify its presence by helping users understand their metrics faster. Decoration competes with data; data wins.
2. **The flow is one thing** — event → metric → monitor → workflow should feel like a single connected experience. Avoid making users hunt across four separate sections to complete one setup.
3. **Personality in the margins** — quirk and warmth live in empty states, loading moments, copy, and transitions. The metric canvas stays clean and honest.
4. **Built for both fluencies** — abstract the technical complexity, expose depth on demand. A PM and an SRE should both feel at home on the same screen.
5. **Trustworthy by default** — honest labels, accurate scales, no chart crime. The interface earns trust by never misleading, even subtly.

## Accessibility & Inclusion

Target: WCAG 2.1 AA. Minimum 4.5:1 contrast for body text, 3:1 for large text. Full keyboard navigation. Screen reader support for data tables and charts. Reduced-motion alternatives for all animations.
