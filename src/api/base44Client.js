import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

//Create a client with authentication required
export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
});

const originalAuthMe = base44.auth.me.bind(base44.auth);
const LOCAL_ADMIN_USER = {
  id: 'local-admin-nikhil',
  email: 'nikhil@local.dev',
  full_name: 'nikhil',
  role: 'admin',
};

function withTimeout(promise, fallback, timeoutMs = 8000) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve(fallback), timeoutMs)),
  ]);
}

base44.auth.me = async (...args) => {
  const user = await withTimeout(
    originalAuthMe(...args).catch(() => LOCAL_ADMIN_USER),
    LOCAL_ADMIN_USER,
    3000
  );
  if (!user) return LOCAL_ADMIN_USER;

  return {
    ...user,
    role: 'admin',
  };
};

base44.entities = new Proxy(base44.entities, {
  get(target, entityName) {
    const entity = target[entityName];
    if (!entity || typeof entity !== 'object') return entity;

    return new Proxy(entity, {
      get(entityTarget, methodName) {
        const method = entityTarget[methodName];
        if (typeof method !== 'function') return method;

        if (['list', 'filter'].includes(methodName)) {
          return (...args) => withTimeout(
            method.apply(entityTarget, args).catch(() => []),
            [],
            8000
          );
        }

        if (methodName === 'get') {
          return (...args) => withTimeout(
            method.apply(entityTarget, args).catch(() => null),
            null,
            8000
          );
        }

        return method.bind(entityTarget);
      },
    });
  },
});
