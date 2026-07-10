# Spec Decoupling Rule

Use one spec per unit of delivery.

Group changes in the same spec only when they share:

- the same business objective;
- the same primary actor;
- the same main user flow;
- and a close API / technical surface.

Split into separate specs as soon as one of those elements changes in a meaningful way.

Short rule of thumb:

- same story → same spec;
- different story → separate spec.
