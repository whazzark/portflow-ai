# Keep the MVP single-site without tenant isolation

The MVP will not implement multi-tenant data isolation. The single operational dataset represents one operating organization working within exactly one site. Users, site references, and other business records belong implicitly to that dataset, so the site is not represented as a separately managed entity and repositories should not accept site, tenant, or operating organization scope arguments.

This keeps the domain model and persistence layer simpler while the product validates the core unloading workflows. If multi-site or multi-organization hosting becomes necessary later, it should be introduced as a dedicated architectural change rather than preloaded into every query.
