# Supabase migration registry

Live project: `zvzafiarwerbuoaccnoz`

This registry was reconciled against the live Supabase migration table on 2026-08-24 UTC. The database currently reports these applied migrations, in order:

1. `20260820053941` — `secure_rls_auto_enable_function`
2. `20260820060655` — `create_identity_organizations_memberships`
3. `20260820060742` — `harden_organization_rls_remove_public_definer_rpcs`
4. `20260820060808` — `optimize_rls_auth_initplans`
5. `20260820065301` — `fix_organization_onboarding_insert_rls`
6. `20260820065436` — `restore_strict_organization_insert_rls`
7. `20260820072003` — `add_organization_onboarding_state`
8. `20260820072502` — `add_secure_integration_connections`
9. `20260820072627` — `add_oauth_connection_states`
10. `20260821052809` — `restore_service_role_select_organization_members`
11. `20260821073523` — `lock_external_accounts_to_single_organization`
12. `20260821080652` — `normalize_integration_metadata_json`
13. `20260821100706` — `add_discovery_import_state`
14. `20260821100744` — `add_discovery_selection_constraints`
15. `20260821105929` — `add_mvp_office_properties_leads_appointments`
16. `20260821110312` — `add_property_assets_property_index`
17. `20260822062704` — `max_lockdown_phase1_least_privilege`
18. `20260822062827` — `max_lockdown_phase2_private_oauth_state`
19. `20260822063004` — `max_lockdown_phase3_remove_oauth_compat`
20. `20260822063027` — `max_lockdown_phase4_service_role_allowlist`
21. `20260822121958` — `add_edge_function_security_rate_limits`
22. `20260824015747` — `cloudco_investment_leads_v1`
23. `20260824040356` — `add_portable_billing_and_gestiones`
24. `20260824040444` — `normalize_unpaid_organizations_to_free`
25. `20260824040517` — `move_billing_provider_tables_private`
26. `20260824041732` — `index_gestiones_user_id`
27. `20260824044024` — `add_property_processing_pipeline`
28. `20260824044325` — `expand_property_locales`
29. `20260824044454` — `lock_property_processing_trigger_functions`
30. `20260824044559` — `auto_prepare_property_processing_manifest`
31. `20260824044903` — `add_provider_neutral_property_ai_queue`
32. `20260824054254` — `add_property_ai_draft_contract`
33. `20260824060354` — `add_multimodel_ai_provider_registry`
34. `20260824060633` — `index_ai_runs_provider_key`
35. `20260824060742` — `add_ai_route_policies`
36. `20260824061155` — `add_ai_provider_runtime_configs`
37. `20260824065145` — `add_video_edit_route_and_pika_gateway`
38. `20260824065950` — `add_heygen_avatar_translation_stack`
39. `20260824084805` — `add_low_cost_technology_registry_and_route_objective`
40. `20260824085004` — `expand_canonical_ai_media_technology_registry`

The current LISTIA billing, property-processing, and AI-engine migrations created in this workflow are stored as SQL files in this repository. Historical migrations remain recorded here while exact SQL snapshots are progressively reconciled from the live migration history; do not re-run a historical migration against production simply because a local SQL file is added later.

No migration in this repository contains passwords, OAuth client secrets, provider tokens, Stripe secret keys, service-role keys, or Vault secret values.
