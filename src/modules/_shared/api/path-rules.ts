/**
 * Regle unique de nommage des chemins de la facade (CA3 et CA4).
 *
 * Ce fichier existe pour une raison precise : la meme regle etait ecrite deux
 * fois — dans `assertRoutePath` (verification a la definition d une route) et
 * dans le lint du contrat (verification du YAML) — et les deux copies avaient
 * deja diverge. `assertRoutePath` ne controlait le pluriel qu au premier
 * segment, le lint le controlait sur tous les segments de ressource :
 * `/price-rules/{id}/history` etait accepte par l un et refuse par l autre.
 *
 * Une regle opposable ne peut pas exister en deux exemplaires. Les deux
 * appelants importent desormais celle-ci.
 */

export const RESOURCE_SEGMENT = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const PATH_PARAM_SEGMENT = /^\{[A-Za-z][A-Za-z0-9_]*\}$/;

/** Noms par lesquels un appelant tenterait d adresser un tenant. */
export const TENANT_ADDRESSING_TOKENS = Object.freeze([
  'tenant',
  'tenants',
  'tenant_id',
  'tenantid',
  'tenant-id',
  'espace',
]);

export type PathViolation = Readonly<{ rule: 'CA3' | 'CA4'; message: string }>;

/**
 * Verifie un chemin RELATIF au prefixe `/api/v1` (ex. `/price-rules/{ruleId}`).
 * Rend la liste des violations ; vide si le chemin est conforme.
 *
 * Regles :
 *  - le chemin commence par `/` et ne repete pas le prefixe de la facade ;
 *  - chaque segment statique est en kebab-case ;
 *  - chaque segment de RESSOURCE est au pluriel. Les segments de ressource
 *    sont ceux d index pair : `/orders/{orderId}/lines/{lineId}` -> `orders`
 *    et `lines` sont des ressources, les index impairs sont des identifiants ;
 *  - aucun segment, statique ou parametre, ne designe un tenant.
 */
export function checkResourcePath(path: string, basePath: string): PathViolation[] {
  const violations: PathViolation[] = [];

  if (!path.startsWith('/') || path.startsWith('//')) {
    violations.push({
      rule: 'CA3',
      message: `le chemin doit commencer par / et etre relatif au prefixe ${basePath}`,
    });
    return violations;
  }
  if (path === `${basePath}` || path.startsWith(`${basePath}/`)) {
    violations.push({
      rule: 'CA3',
      message: `le prefixe ${basePath} est porte par la facade, ne pas le repeter dans le chemin`,
    });
  }

  const segments = path.slice(1).split('/');
  segments.forEach((segment, index) => {
    if (PATH_PARAM_SEGMENT.test(segment)) {
      const name = segment.slice(1, -1).toLowerCase();
      if (TENANT_ADDRESSING_TOKENS.includes(name)) {
        violations.push({
          rule: 'CA4',
          message: `le tenant est resolu depuis le jeton, jamais par le parametre {${segment.slice(1, -1)}}`,
        });
      }
      return;
    }

    if (!RESOURCE_SEGMENT.test(segment)) {
      violations.push({ rule: 'CA3', message: `le segment "${segment}" doit etre en kebab-case` });
      return;
    }
    if (TENANT_ADDRESSING_TOKENS.includes(segment.toLowerCase())) {
      violations.push({
        rule: 'CA4',
        message: `le segment "${segment}" adresse un tenant, qui vient du jeton`,
      });
      return;
    }
    if (isResourcePosition(index) && !segment.endsWith('s')) {
      violations.push({
        rule: 'CA3',
        message: `la ressource "${segment}" doit etre au pluriel`,
      });
    }
  });

  return violations;
}

/** Les segments de ressource occupent les positions paires du chemin. */
export function isResourcePosition(index: number): boolean {
  return index % 2 === 0;
}
