import { supabase } from '@/integrations/supabase/client';

/**
 * Log an audit event using the secure server-side function.
 * Fire-and-forget: never blocks the main action.
 */
export const logAudit = (
  action: string,
  entity: string,
  entityId?: string | null,
  details?: string | null
) => {
  // Fire and forget - don't await, don't block
  supabase.rpc('log_audit', {
    _action: action,
    _entity: entity,
    _entity_id: entityId ?? null,
    _details: details ?? null,
  }).then(({ error }) => {
    if (error) console.warn('Audit log failed:', error.message);
  });
};
