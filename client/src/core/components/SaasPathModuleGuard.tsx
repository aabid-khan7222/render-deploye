import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { useSelector } from 'react-redux';
import { selectUser } from '../data/redux/authSlice';
import {
  isSaasPathRouteLocked,
  resolveSaasModuleKeyForLockPage,
} from '../utils/saasModuleAccess';
import SaasModuleLockPage from './SaasModuleLockPage';
import './saasModuleLock.css';

type Props = {
  children: ReactNode;
};

/**
 * Path-based SaaS lock for Peoples and Academic routes (many URLs, one guard).
 * Academic sub-modules are resolved per URL segment.
 */
const SaasPathModuleGuard = ({ children }: Props) => {
  const location = useLocation();
  const user = useSelector(selectUser);
  const locked = isSaasPathRouteLocked(user?.saas_modules, location.pathname);
  const moduleKey = resolveSaasModuleKeyForLockPage(location.pathname);

  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [locked]);

  if (!locked || !moduleKey) {
    return <>{children}</>;
  }

  return (
    <div className="saas-module-guard saas-module-guard--locked">
      <div
        className="saas-module-guard__content saas-module-guard__content--locked"
        aria-hidden
      >
        {children}
      </div>
      <SaasModuleLockPage moduleKey={moduleKey} />
    </div>
  );
};

export default SaasPathModuleGuard;
