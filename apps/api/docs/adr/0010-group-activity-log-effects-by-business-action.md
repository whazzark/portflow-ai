# Group Activity Log effects by business action

The Discharge Activity Log will create one entry for each accepted business action and group all significant effects of that action in its payload. This keeps the user-visible timeline aligned with operational intent and atomic transaction boundaries instead of emitting several adjacent entity-level entries for one command, such as activating both a Discharge and its first Shift; rejected commands and authorization failures remain in technical or security logging instead of polluting the operational timeline.
