(() => {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  ready(() => {
    const businessForm = document.getElementById('businessForm');
    if (businessForm) {
      businessForm.addEventListener('submit', async event => {
        event.preventDefault();
        event.stopImmediatePropagation();

        const name = document.getElementById('businessName')?.value.trim() || '';
        const type = document.getElementById('businessType')?.value || '';
        const market = document.getElementById('businessMarket')?.value.trim() || '';
        if (!name || !type || !market) {
          message(t('msg.complete_three_fields'), 'error');
          return;
        }

        const btn = event.submitter;
        if (btn) {
          btn.disabled = true;
          btn.textContent = t('msg.saving');
        }

        try {
          const session = await getValidSession();
          if (!session) throw new Error(t('msg.session_expired'));

          const user = await getCurrentUser(session);
          const existing = await getUserOrganization(session, user.id);
          if (existing) {
            // Never jump directly to Office just because the organization exists.
            // Resume from the persisted onboarding step instead.
            await routeAuthenticated(session);
            return;
          }

          const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
          await api('/rest/v1/organizations', {
            method: 'POST',
            accessToken: session.access_token,
            extraHeaders: { Prefer: 'return=minimal' },
            body: {
              name,
              business_type: type,
              primary_market: market,
              timezone
            }
          });

          const org = await getUserOrganization(session, user.id);
          if (!org) throw new Error(t('msg.workspace_created_load_error'));

          message(t('msg.workspace_created'), 'success');
          const onboarding = await getOnboardingState(session, org.id);
          showPlan(org, onboarding || { selected_plan: 'free' });
        } catch (error) {
          message(localizeError(error), 'error');
        } finally {
          if (btn) {
            btn.disabled = false;
            btn.textContent = t('common.continue');
          }
        }
      }, true);
    }

    const completeDiscoveryBtn = document.getElementById('completeDiscoveryBtn');
    if (completeDiscoveryBtn) {
      completeDiscoveryBtn.addEventListener('click', async event => {
        event.preventDefault();
        event.stopImmediatePropagation();

        const btn = event.currentTarget;
        btn.disabled = true;
        btn.textContent = t('msg.continuing');

        try {
          const session = await getValidSession();
          if (!session) throw new Error(t('msg.session_expired'));
          const user = await getCurrentUser(session);
          const org = await getUserOrganization(session, user.id);
          if (!org) throw new Error(t('msg.business_not_found'));

          const connection = await getGoogleConnection(session, org.id);

          if (connection) {
            await api('/functions/v1/google-discovery', {
              method: 'POST',
              accessToken: session.access_token,
              body: { organization_id: org.id, action: 'complete' }
            });
          } else {
            // Google is optional. Completing Discovery without a Google connection
            // must advance onboarding instead of calling a Google-only function.
            await updateOnboardingState(session, org.id, {
              current_step: 5,
              completed_steps: [1, 2, 3, 4],
              discovery_inputs: {
                google_skipped: true,
                completed_without_google: true,
                completed_at: new Date().toISOString()
              }
            });
          }

          const onboarding = await getOnboardingState(session, org.id);
          await showBusinessDNA(org, session, onboarding);
        } catch (error) {
          message(localizeError(error), 'error');
        } finally {
          btn.disabled = false;
          btn.textContent = t('common.continue');
        }
      }, true);
    }
  });
})();