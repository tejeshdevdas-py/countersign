import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import { useSignInToCindy } from '@/hooks/useSignInToCindy';
import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';

/** 首页零模型单行动卡:未登录走 states.html B,已登录无来源走开通官方服务。 */
export function HomeZeroModelAction({
  authMode,
  narrow,
}: {
  authMode: 'signed-out' | 'local' | 'cloud';
  narrow: boolean;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const signInToCindy = useSignInToCindy();
  const cloud = authMode === 'cloud';
  // Countersign: no cloud sign-in; only the own-provider action remains.
  const localSignInHidden = LOCAL_ONLY && !cloud;

  return (
    <div data-testid="home-zero-model" className="mt-4 w-full">
      <div
        className={cn(
          'flex w-full items-center gap-4 rounded-xl border border-[var(--border-default)] bg-[var(--surface-elevated)] px-[18px] py-4',
          narrow && 'flex-col items-stretch',
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="text-15 font-medium leading-snug text-[var(--text-primary)]">
            {localSignInHidden
              ? t('onboarding.connectProvider.title')
              : t(cloud ? 'onboarding.homeZeroModel.cloudTitle' : 'onboarding.homeZeroModel.title')}
          </p>
          <p className="text-13 leading-relaxed text-[var(--text-secondary)]">
            {localSignInHidden
              ? t('onboarding.connectProvider.desc')
              : t(cloud ? 'onboarding.homeZeroModel.cloudDesc' : 'onboarding.homeZeroModel.desc')}
          </p>
        </div>
        {localSignInHidden ? null : <Button
          variant="cta"
          size="lg"
          compact
          type="button"
          data-testid="home-zero-model-cta"
          onClick={() => {
            if (cloud) {
              navigate('/settings?tab=providers&connect=xd');
              return;
            }
            void signInToCindy();
          }}
          className={cn(narrow && 'self-end')}
        >
          {t(cloud ? 'onboarding.homeZeroModel.cloudCta' : 'onboarding.homeZeroModel.cta')}
        </Button>}
      </div>
      <button
        type="button"
        data-testid="home-zero-model-own-api"
        onClick={() => navigate('/settings?tab=providers&wizard=1')}
        className="mt-2 ml-2 inline-flex items-center gap-0.5 rounded-lg px-2 py-1 text-12 font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
      >
        {t('onboarding.homeZeroModel.ownApi')}
        <ChevronRight size={13} strokeWidth={2} />
      </button>
    </div>
  );
}
