# Unloading Management

This context covers discharge operations where material is unloaded from a vessel and moved through operational checkpoints such as docks, weighing areas, rotations, shifts, warehouses, and reporting documents.

## Language

**Discharge**:
The complete operation of unloading bulk material from a vessel on a site, potentially across several days, shifts, customers, product lots, rotations, and warehouses.
_Avoid_: unloading operation, bulk unloading

**Planned Discharge**:
A discharge that has been created but has not started operationally.
_Avoid_: scheduled discharge

**Discharge Preparation**:
The planning of a discharge before it starts, including the vessel, dock, customers, product lots, warehouses, at least one planned shift, and expected start.
_Avoid_: setup, configuration

**Discharge Start Confirmation**:
The operations lead's confirmation when starting the first shift that the planned customers, product lots, and required warehouse door assignments match the discharge. Successful confirmation atomically activates both the discharge and its first shift.
_Avoid_: discharge validation, shift setup

**Product Lot Description**:
The free-text descriptive information of a product lot, distinct from its identifying product name, that can be corrected, including after discharge closure, without changing which customer, product name, or expected material quantity the lot represents. Post-closure corrections require a comment and do not alter existing report snapshots.
_Avoid_: product lot identity

**Active Discharge**:
A discharge that has started and is still expected to receive shifts or rotations. It remains active between shifts and during downtime until explicitly closed.
_Avoid_: open discharge

**Discharge Closure**:
The explicit declaration that a discharge's physical operation is finished. It records who closed the discharge and when, may include an optional comment, and remains independent from the later validation of completed rotations and generation of the Final Discharge Report.
_Avoid_: automatic completion, administrative finalization

**Closed Discharge**:
A discharge explicitly declared physically finished after all its shifts are completed and no rotation remains in progress. It receives no new shifts or rotations, while completed rotations may still be corrected and validated before the Final Discharge Report; completing a shift never closes its discharge implicitly.
_Avoid_: archived discharge

**Discharge Activity Log**:
The automatic history of business changes, operational events, and report downloads recorded for a discharge, including every shift lifecycle transition, rotation weighing entry, empty return confirmation, rotation correction or cancellation, and preparation or adjustment change. It retains identifiers for durable referenced entities and resolves their current labels when consulted, while preserving the actual business values changed by each event.
_Avoid_: audit trail, technical log

**Activity Log Entry**:
The permanently retained immutable record of one accepted business action in a Discharge Activity Log, grouping all significant effects produced by that action even when several related entities change. Rejected commands, authorization failures, and invalid attempts belong to technical or security logging rather than this operational history.
_Avoid_: log line, entity event

**Activity Log Category**:
The stable classification used to browse and filter Activity Log Entries: Discharge lifecycle, preparation, Shifts and Downtimes, Rotations and Weighings, runtime resources, or reports. A Shift resource change is preparation before Discharge activation and a runtime-resource change afterward; every entry has exactly one category determined by its primary business intent.
_Avoid_: event domain, technical namespace

**Activity Log Entry Time**:
The immutable server time at which an accepted business action is recorded, used to position its entry in the Discharge Activity Log. Retrospective or corrected operational times remain facts inside the entry and never move it in the timeline.
_Avoid_: operational event time, corrected time

**Report Snapshot Download**:
The successful delivery of authorized access to a Report Snapshot PDF, through either a file response or a signed storage URL. It does not claim that the client received every byte of the file.
_Avoid_: confirmed file transfer, report view

**Vessel**:
A ship carrying bulk material to be unloaded during a discharge, described directly on that discharge rather than managed as a site reference.
_Avoid_: boat, ship

**Vessel Description**:
The name, IMO, and comment identifying or describing the vessel of a discharge. These fields may be corrected with a comment after discharge closure without altering existing report snapshots.
_Avoid_: vessel reference, vessel identity record

**Shift**:
A work period, identified to users by its planned start time, during which a designated responsible follows part of a discharge. A shift moves successively through planned, active, and completed states; actual shift periods never overlap and always contain every rotation and downtime that belongs to them.
_Avoid_: work period, time slot

**Planned Shift**:
A shift prepared for future work that has not started yet, including while its discharge is active. It may be removed or rescheduled before starting; planned shifts do not overlap, are separated by an inter-shift break, and start in chronological order, while their planned times do not trigger lifecycle transitions.
_Avoid_: scheduled shift, upcoming shift

**Planned Shift Removal**:
The permanent removal of a Planned Shift from its Discharge preparation, without introducing a removed Shift state. Its Activity Log Entry retains the former Shift identifier and planned period while references to its responsible and operational resources continue to resolve their current labels.
_Avoid_: shift cancellation, removed shift state, draft deletion

**Inter-Shift Break**:
The planned interval between two successive shifts of one discharge during which no shift is expected to be active. It has no fixed minimum duration and is not a downtime.
_Avoid_: downtime, shift overlap

**Active Shift**:
A shift manually started after its responsible and operational resources are revalidated, with its actual start time recorded and its planned time range preserved. It has at least one assigned truck, warehouse door, and weighing area; it may start before its planned time once the previous shift is completed, and a discharge has at most one active shift at a time.
_Avoid_: current shift, open shift

**Completed Shift**:
A shift irreversibly ended at its recorded actual end time that no longer receives new operational events. It may contain no rotation, but completing a shift with no rotation or downtime requires a comment; it has no in-progress rotation or ongoing downtime, while existing information may be corrected with a required comment while the discharge remains active.
_Avoid_: closed shift, finished shift

**Shift Preparation**:
The explicit selection of one shift's planned time range, responsible, trucks, warehouse doors, and weighing areas. Resources are not inherited automatically from another shift, the dock belongs to the discharge rather than the shift, and every preparation change is traceable.
_Avoid_: shift setup, resource availability

**Shift Responsible**:
An active operations lead, operations admin, or organization admin accountable for a shift without being its exclusive operational actor. Every shift has one designated responsible, while other authorized operations leads or admins may record rotations from the shift's different weighing areas; every reassignment is traceable, and every non-completed shift must be reassigned before its responsible loses eligibility.
_Avoid_: shift owner, transition actor

**Shift Adjustment**:
A traceable change made during a shift to its responsible or resources, preserving the values before and after the change. An active shift always retains at least one truck, warehouse door, and weighing area; a resource used by an in-progress rotation cannot be removed, and replacing the last resource of one type is atomic.
_Avoid_: shift edit, resource update

**Downtime**:
A non-overlapping timed event within one shift's actual period that explains when work was delayed or stopped. Its positive duration is calculated from actual start and end times, which may be entered retrospectively or corrected with a required comment.
_Avoid_: shift status, stoppage status

**Ongoing Downtime**:
A downtime that has started but whose interruption has not ended yet. A shift has at most one ongoing downtime at a time.
_Avoid_: open downtime, active downtime

**Completed Downtime**:
A downtime whose interruption has ended and whose actual end time has been recorded. It never becomes ongoing again; a later interruption creates another downtime.
_Avoid_: closed downtime, finished downtime

**Cancelled Downtime**:
An ongoing or completed downtime declared erroneous with a required comment while its discharge remains active. It remains traceable but is excluded from durations, dashboards, and future report snapshots.
_Avoid_: deleted downtime, removed downtime

**Downtime Reason**:
The business reason selected from the fixed list weather, technical issue, truck shortage, dock unavailable, waiting for instructions, or other. The other reason requires a comment.
_Avoid_: downtime type, incident type

**Operating Organization**:
An organization that operates bulk unloading activities within exactly one site and owns the operational data for those activities.
_Avoid_: tenant, account

**Site**:
A physical operational footprint inside or across a port where one operating organization manages bulk unloading activities. It is the shared scope of the site's operational references.
_Avoid_: port, location, tenant

**Site Reference**:
A reusable customer, transport company, truck, dock, weighing area, warehouse, or warehouse door managed for the site's discharge operations.
_Avoid_: lookup value, configuration record

**Checkpoint**:
The interface category grouping the site's docks and weighing areas, where trucks are respectively loaded and weighed during discharge operations. A checkpoint is not a separate site reference and does not replace the distinct identities or business rules of docks and weighing areas.
_Avoid_: checkpoint entity, operational checkpoint record

**Available Site Reference**:
A site reference that can be selected for new operational usages. Being unarchived is not sufficient: a suspended truck is neither archived nor available. A truck reaches this state by two distinct routes — reactivation from archived, and return to service from suspended.
_Avoid_: active resource, enabled resource

**Archived Resource**:
A read-only site reference retired from the site's working set, no longer available for new operations but still visible in administration, historical discharges, and reports. Site references are never permanently deleted, and a reference cannot be archived while it is referenced by a planned or active discharge. Archival is a deliberate retirement and is distinct from the temporary immobilisation a Suspended Truck records.
_Avoid_: deleted resource, inactive resource, suspended resource

**Site Reference Reactivation**:
The restoration of an archived site reference for use in new operations, while preserving its identity and history. The reference retains who last reactivated it and when.
_Avoid_: resource recreation, unarchive

**Warehouse**:
A storage destination on the site where bulk material is deposited after being transported from a vessel, with quantities derived from validated rotations. A warehouse may serve several active discharges through distinct doors, and it cannot be archived while it still has available warehouse doors.
_Avoid_: store, shop, magasin

**Warehouse Footprint**:
The required geographic polygon outlining the operational footprint of a warehouse, including the areas where trucks position themselves for unloading. Its display center is derived from the polygon rather than stored separately.
_Avoid_: warehouse GPS location, warehouse center, address

**Warehouse Door**:
A designated unloading door permanently belonging to one warehouse where a truck deposits bulk material.
_Avoid_: warehouse gate, unloading point

**Warehouse Door Assignment**:
The traceable assignment of a warehouse door to one product lot during a discharge, meaning rotations to that door are associated with that product lot while the assignment is active. A door can have only one effective assignment across all active discharges on the site.
_Avoid_: warehouse assignment, storage assignment

**Warehouse Door GPS Location**:
The required latitude and longitude of the operational point where a truck stops to unload at a warehouse door, located within or on the boundary of its warehouse footprint.
_Avoid_: warehouse location

**Default Warehouse Door**:
A warehouse door proposed by the interface for a truck's next rotation to avoid repeated entry. It is the door most recently selected for that truck in the active shift; without truck history, the shift's only door is proposed, while several available doors require an explicit choice. The operations lead may replace the proposal before creating the rotation; the selected target door is then captured by that rotation.
_Avoid_: default warehouse, assigned door, fixed door

**Rotation Door Correction**:
A commented replacement of an unvalidated rotation's target warehouse door with another door that belonged to its shift and was assigned to the rotation's immutable product lot when the rotation occurred. Historical eligibility applies even if the door has since been removed from the shift or archived; the correction retains the previous door, replacement door, actor, and correction time in the discharge activity log.
_Avoid_: product lot correction, silent destination edit

**Dock**:
The named operational berth with a required GPS location where a vessel is discharged during a discharge. A dock can serve at most one active discharge at a time.
_Avoid_: quay, loading point

**Dock GPS Location**:
The required latitude and longitude of the operational point where trucks are loaded at a dock.
_Avoid_: dock center, dock address

**Dock Reassignment**:
A traceable change of the dock serving an active discharge. Previous rotations retain their original dock, while later rotations use the newly assigned dock.
_Avoid_: dock edit, shift dock change

**Truck**:
A vehicle registered for the site, provided by exactly one transport company at a time, and used for rotations during a shift. It is available, suspended, or archived; it leaves the suspended state only by being Returned to Service. A truck can be assigned to at most one planned or active discharge, can have at most one in-progress rotation across the site, and its transport company cannot change while the truck is used by a planned or active discharge.
_Avoid_: driver, vehicle

**Suspended Truck**:
A truck temporarily out of service — a breakdown, a maintenance slot, a technical inspection — that remains a live site reference under the same identity, registration, and transport company, with its registration still reserved. It is excluded from every collection offering trucks for new operational work, while the discharges, shifts, and rotations it is already part of continue untouched. Suspension records its time, responsible administrator, and an optional comment; every active role can see that a truck is suspended, along with when and why, while the responsible administrator remains administration context. It is entered only from available: an archived truck must be reactivated first, and a suspended truck must be Returned to Service before it can be archived, reactivated, or updated.
_Avoid_: broken truck, inactive truck, archived truck, out-of-service resource

**Returned to Service**:
The end of a truck's suspension, restoring its availability for new discharges, shift assignments, and rotations through the assignments it kept while out of service. It is the reverse of suspension and is distinct from Site Reference Reactivation, which reverses an archival; a truck records both kinds of context side by side, and returning it to service never erases the suspension it ended. It is refused while the truck's transport company is archived, because an archived company may provide no available truck — and since a suspended truck cannot be reassigned, reactivating that company is the only way through.
_Avoid_: reactivated truck, unsuspended truck, unarchived truck

**Discharge Truck Assignment**:
The reservation of a truck, its current registration, and its current transport company for one discharge. Each shift uses a subset of the assigned trucks; completing a shift does not release them, and later reference changes do not alter historical assignments.
_Avoid_: shift truck ownership, truck availability

**Truck Registration**:
The mandatory, editable business identifier displayed on a truck's registration plate and used by the site to distinguish it from every other available or archived truck. Historical discharge assignments retain the registration captured at reservation time. All trucks use the same registration country in the MVP.
_Avoid_: visible identifier, truck code

**Vehicle Model**:
The free-text descriptive model of a truck.
_Avoid_: truck type

**Truck Capacity**:
The maximum authorized payload that a truck may carry, expressed in tonnes.
_Avoid_: gross vehicle weight, trailer volume, bed volume

**Transport Company**:
A company registered for the site that operationally provides trucks used during shifts, whether or not it legally owns those vehicles. It cannot be archived while it still provides available trucks.
_Avoid_: carrier, haulier

**Rotation**:
A truck movement by one immutable truck that starts with an empty weighing and a selected target warehouse door, continues through loading at the dock, loaded weighing in the same weighing area, and deposit at that door, then ends when the truck's empty return to that area is confirmed. That confirmation may accompany a new empty weighing that starts the truck's next rotation, or only complete the current rotation when no continuation is planned. The rotation captures its immutable product lot from the target door's effective assignment when it is created; its target door remains correctable until operations lead validation, but only to another eligible door assigned to that same product lot.
_Avoid_: truck turn, truck trip

**Rotation Business ID**:
An immutable, human-readable identifier generated for a rotation and unique across the site, such as `ROT-000123`. It carries no encoded Shift or date meaning and is never reused, including after cancellation.
_Avoid_: rotation database ID, shift rotation number

**Rotation-Eligible Truck**:
An available truck assigned to the active discharge and active shift that has no in-progress rotation anywhere on the site. During continuation, the current truck becomes eligible through the same operation that completes its preceding rotation and starts the next one. Suspending a truck removes its eligibility without interrupting a rotation already in progress: that rotation runs through to its empty return confirmation, but a continuation may not start a new rotation for a suspended truck. Returning the truck to service restores eligibility under these same rules, through the shift assignment it kept while suspended; a rotation still in progress is unaffected and does not become a second concurrent rotation.
_Avoid_: any discharge truck, selectable truck

**Weighing Area**:
An operational checkpoint organized around a weighbridge, where truck weights are recorded before and after loading bulk material. It may serve rotations from several active discharges.
_Avoid_: scale, weighbridge

**Weighing Area GPS Location**:
The required latitude and longitude of the point where a truck is positioned on the weighbridge.
_Avoid_: operator office location, approximate area center

**Empty Weighing**:
A weighing of a truck without bulk material that starts a rotation and contributes to its net tonnage calculation. When operations continue after a previous rotation, the new empty weighing belongs only to the next rotation while the accompanying empty return confirmation completes the previous one.
_Avoid_: tare weighing, weighing to empty

**Effective Empty Weighing**:
The empty weighing value currently governing a rotation's net tonnage, initially provided by its physical empty weighing and replaceable only through a permitted correction or post-validation adjustment.
_Avoid_: original empty weighing, current tare

**Empty Return Confirmation**:
The confirmation that a truck returned empty to the same weighing area after deposit, recording its time, actor, and area without retaining a weight value. It completes the preceding rotation; with continuation, the same action also records a new empty weighing owned only by the next rotation.
_Avoid_: return empty weighing, closing weight

**Loaded Weighing**:
A physical weighing of a loaded truck after it has received bulk material at the dock, performed in the same weighing area as the rotation's opening empty weighing. A rotation retains every successive loaded weighing when excess product must be removed before transport can continue.
_Avoid_: gross weighing, full weighing

**Effective Loaded Weighing**:
The loaded weighing value currently governing a rotation's net tonnage, initially provided by its latest capacity-compliant physical loaded weighing and replaceable only through a permitted correction or post-validation adjustment. A post-validation adjustment may make it reveal a Truck Capacity Breach.
_Avoid_: corrected loaded weighing, final loaded weighing

**Net Tonnage**:
The quantity of bulk material carried by a rotation, calculated as effective loaded weighing minus effective empty weighing.
_Avoid_: payload, net weight

**Tonnage Measurement**:
A strictly positive weight measurement expressed in tonnes with no more than three decimal places and displayed with three decimal places. Zero and negative measurements are invalid.
_Avoid_: kilogram measurement, rounded tonnage

**Expected Tonnage**:
The indicative quantity planned for a discharge, obtained from the expected quantities of its product lots. Differences from physically completed work are normal and never prevent discharge closure.
_Avoid_: target tonnage, contractual tonnage

**Realized Tonnage**:
The effective net tonnage of all non-cancelled completed and validated rotations in a discharge. It represents physically completed work independently of its validation progress.
_Avoid_: completed tonnage, validated tonnage

**Validation Progress**:
The portion of a discharge's realized work that has been checked, expressed through the number of validated rotations and the realized tonnage that remains to be validated. It is distinct from realized tonnage and may continue progressing after discharge closure.
_Avoid_: third tonnage, completion progress

**Manual Weighing Entry**:
A weighing value entered by an operations lead rather than imported automatically from weighing equipment.
_Avoid_: scale import, automatic weighing

**Weighing Time**:
The immutable server-recorded time at which an empty or loaded weighing is entered. Operations users enter and may correct the measurement value, but they do not enter or correct its operational time.
_Avoid_: user-entered weighing time, corrected weighing time

**Weighing Correction**:
A commented correction of a manually entered weighing before the rotation that owns the measurement is validated. It retains the previous value, corrected value, actor, and correction time in the discharge activity log.
_Avoid_: weight overwrite, silent edit

**Weighing Area Correction**:
A commented correction, before rotation validation, of the single weighing area attributed to all measurements of a rotation. The replacement area must have belonged to the shift when the measurements occurred; a correction never attributes one rotation's measurements to different areas.
_Avoid_: weighing area switch, mixed-area weighing

**Product Lot**:
A traceable quantity of bulk material from a vessel for a customer within a discharge, uniquely identified by that customer and product name, with a total expected quantity.
_Avoid_: product, stock

**Customer**:
A company registered for the site that owns one or more product lots unloaded and stored during a discharge. A customer is neither the vessel owner nor a user of the application.
_Avoid_: client, account, customer user, vessel owner

**Customer Code**:
The unique, editable business identifier assigned to a customer by an operations admin and normalized in uppercase without surrounding spaces. Historical views use its current value, while existing report snapshots retain the value captured when they were generated.
_Avoid_: customer database ID, customer UUID

**Operations Lead Validation**:
The operations lead's confirmation that a completed rotation has been checked and can be treated as final for operational reporting. The validating user may also have entered the rotation's weighings; entry and validation actors remain separately traceable. Validation may occur before or after discharge closure, and the Final Discharge Report requires every non-cancelled rotation to be validated.
_Avoid_: approval, confirmation

**Discharge Report**:
A document generated for a discharge at a point in time, including a report section for each shift covered by that generation.
_Avoid_: reporting document

**Shift Report Section**:
The part of a discharge report that summarizes one started shift, including its initial and final responsible, rotations, tonnage, downtimes, and every truck, warehouse door, and weighing area assigned during it, distinguishing mobilized resources from those actually used. Each reported rotation exposes its effective empty weighing, loaded weighing, and net tonnage, signals truck capacity exceedances and breaches, identifies adjusted values, and includes its adjustment history; started shifts remain represented even without validated rotations, while planned shifts are excluded.
_Avoid_: shift report, shift document

**Report Snapshot**:
A stored, immutable generated version of a discharge report that captures the validated discharge data at a specific point in time.
_Avoid_: live report, draft report

**Outdated Report Snapshot**:
An immutable report snapshot generated before a later rotation adjustment changed data it covers. It remains downloadable as a historical record but is explicitly marked as no longer representing the current effective values.
_Avoid_: invalid report, deleted report

**Final Discharge Report**:
A Report Snapshot generated once every non-cancelled rotation of a discharge has been validated, certifying the discharge's operational data as complete. It may be generated before or after discharge closure and remains subject to the same Outdated Report Snapshot rules as any other Report Snapshot.
_Avoid_: closing report, final validation report

**Operations Dashboard**:
A read-only real-time view of all active discharges for an operating organization. It shows the active shift when one exists, otherwise the most recently started shift, while keeping the next planned shift distinct; downtime totals cover the whole discharge.
_Avoid_: admin dashboard, reporting screen

**Operational Alert**:
A non-blocking signal that highlights a potential operational issue requiring user attention.
_Avoid_: blocking error, validation failure

**Truck Capacity Exceedance**:
A blocking condition recorded when a loaded weighing produces a net tonnage above the truck's maximum authorized payload. The truck must return to the dock to remove product and undergo another loaded weighing before it may proceed to deposit; every attempt remains traceable.
_Avoid_: capacity alert, overload warning

**Truck Capacity Breach**:
An irreversible compliance incident revealed after validation when a rotation's adjusted effective net tonnage exceeds the truck's maximum authorized payload. The truthful adjustment remains effective, while the breach is recorded in the discharge activity log and exposed in future report snapshots.
_Avoid_: capacity alert, corrected exceedance

**In Progress Rotation**:
A rotation that has started but does not yet have all required operational information.
_Avoid_: open rotation

**Cancelled Rotation**:
An in-progress rotation declared void with a required comment before its truck is loaded, when the planned movement cannot continue. It remains traceable and is excluded from tonnage, dashboards, and report snapshots; a loaded truck's rotation cannot be cancelled.
_Avoid_: deleted rotation, removed rotation

**Completed Rotation**:
A rotation whose truck has deposited its material and whose empty return to the weighing area has been confirmed, but that has not yet been checked by an operations lead. The final rotation of a truck is subject to the same return confirmation requirement even when no later rotation is planned.
_Avoid_: finished rotation

**Validated Rotation**:
A completed rotation that has been irreversibly checked by an operations lead and can be used in final operational reporting. It may be validated while the same truck's next rotation is still in progress because its completion does not own or depend on that next rotation's opening empty weighing; later corrections require rotation adjustments rather than a return to the completed state.
_Avoid_: approved rotation

**Rotation Adjustment**:
A traceable post-validation correction that atomically groups one or more changes to a validated rotation's effective empty weighing, loaded weighing, common weighing area, or target warehouse door under one required comment. It preserves each previous and corrected value and each weighing delta; once recorded, it is immutable, and correcting it requires another adjustment based on the latest effective values.
_Avoid_: rotation edit, post-validation edit

**Validation Comment**:
A comment entered during operations lead validation to provide additional details about a rotation before it becomes non-editable.
_Avoid_: correction comment, note

**Organization Admin**:
A user responsible for managing users and their access within an operating organization, including read and write access to active and deactivated users, with the permissions of an operations admin, operations lead, and observer.
_Avoid_: operations admin, user manager

**User Invitation**:
The action of granting a person the possibility to activate their own user access before they can sign in.
_Avoid_: user creation, account creation

**Pending User**:
A user whose access has been invited but not activated yet.
_Avoid_: invited user, inactive user

**Pending User Removal**:
The action of permanently removing a user whose access has never been activated.
_Avoid_: user deletion, active user deletion

**User Access Status**:
The access state of a user, distinguishing whether they are pending activation, active, deactivated, or cancelled before activation.
_Avoid_: invitation status, account status

**User Access Status Change**:
A dated change to a user's access status, optionally attributed to the user who caused it.
_Avoid_: user status update, access log entry

**User Role Change**:
The action of changing the responsibility level assigned to a user.
_Avoid_: permission edit, profile update

**User Identity Update**:
The action of changing the identifying information of a user, either by the user themselves or by an organization admin.
_Avoid_: profile update, account edit

**Login**:
The action by which an active user establishes an authenticated session by presenting valid credentials. Every non-active access status is rejected with the same outcome as invalid credentials, so the response never reveals which reason applied.
_Avoid_: sign in, authentication

**Temporary Session**:
An authenticated session that ends when the user closes their browser. It is distinct from a remembered connection, which may restore access across browser restarts.
_Avoid_: short-lived remembered connection, persistent session

**Remembered Connection**:
An authenticated connection that can be restored on the same browser for at most 30 days from login. Logging out on that browser revokes its restoration token without affecting other browsers.
_Avoid_: permanent login, global session, device management

**Password Reset**:
The action of requiring an active user to choose a new password.
_Avoid_: password change, password recovery

**User Invitation Cancellation**:
The action of withdrawing access before a pending user has activated it.
_Avoid_: pending user deletion, invitation deletion

**User Invitation Restoration**:
The action of making a cancelled user invitation pending again.
_Avoid_: resend invitation, recreate invitation

**User Invitation Acceptance**:
The action by which a pending user activates their access by choosing their initial password.
_Avoid_: first login, account setup

**User Activation Link**:
A confidential link that allows a pending user to accept their invitation and choose their initial password.
_Avoid_: login link, magic link

**User Activation Link Renewal**:
The action of replacing an activation link for a pending user without creating or restoring an invitation.
_Avoid_: invitation restoration, resend invitation

**User Deactivation**:
The action of preventing a user from signing in while keeping their historical actions visible.
_Avoid_: user deletion, user archiving

**User Reactivation**:
The action of restoring sign-in access to a deactivated user while requiring a new password.
_Avoid_: user restoration, account unlock

**Operations Admin**:
A user responsible for configuring the operational entities of a site and consulting active users in the operating organization, with the permissions of an operations lead and observer.
_Avoid_: organization admin, generic admin

**Operations Lead**:
A user responsible for starting, following, and completing shifts, entering and checking rotations, and generating report snapshots, with the permissions of an observer.
_Avoid_: operator

**Observer**:
A user who can consult discharge information and report snapshots without changing operational data.
_Avoid_: reader
