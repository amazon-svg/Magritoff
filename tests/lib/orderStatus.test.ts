/**
 * Tests vitest pour orderStatus.ts (Story S3.1 AC4 + AC7).
 *
 * Lancer : `pnpm vitest run src/app/lib/orderStatus.test.ts`
 */

import { describe, it, expect } from "vitest";
import {
  STATUS_LABELS,
  ALL_ORDER_STATUSES,
  ORDER_STATUSES_WORKFLOW,
  ORDER_STATUSES_TERMINAL,
  ORDER_STATUSES_LEGACY,
  getStatusInfo,
  labelToStatus,
  type OrderStatus,
} from "../../src/app/lib/orderStatus";

describe("orderStatus / STATUS_LABELS", () => {
  it("contient les 7 statuts canoniques tenant_orders v1.1", () => {
    const v11Statuses: OrderStatus[] = [
      "draft",
      "validated",
      "in_production",
      "shipped",
      "delivered",
      "invoiced",
      "cancelled",
    ];
    for (const s of v11Statuses) {
      expect(STATUS_LABELS[s]).toBeDefined();
      expect(STATUS_LABELS[s].label).toBeTruthy();
      expect(STATUS_LABELS[s].className).toMatch(/bg-\w+/);
    }
  });

  it("contient les 2 statuts shop_orders legacy", () => {
    expect(STATUS_LABELS.pending.group).toBe("legacy");
    expect(STATUS_LABELS.approved.group).toBe("legacy");
  });

  it("groupe correctement workflow / terminal / legacy (partition exhaustive)", () => {
    const union = [
      ...ORDER_STATUSES_WORKFLOW,
      ...ORDER_STATUSES_TERMINAL,
      ...ORDER_STATUSES_LEGACY,
    ];
    // Pas de doublon entre les 3 groupes
    expect(new Set(union).size).toBe(union.length);
    // Couvre tous les statuts canoniques
    expect(union.sort()).toEqual([...ALL_ORDER_STATUSES].sort());
  });
});

describe("orderStatus / getStatusInfo", () => {
  it("retourne le mapping correct pour chaque statut canonique", () => {
    expect(getStatusInfo("draft").label).toBe("Brouillon");
    expect(getStatusInfo("draft").group).toBe("workflow");

    expect(getStatusInfo("delivered").label).toBe("Livrée");
    expect(getStatusInfo("delivered").group).toBe("terminal");

    expect(getStatusInfo("cancelled").className).toContain("err");

    expect(getStatusInfo("pending").group).toBe("legacy");
  });

  it("fallback safe pour statut inconnu (label = raw, className neutre)", () => {
    const info = getStatusInfo("unknown_future_status_xyz");
    expect(info.label).toBe("unknown_future_status_xyz"); // debug-friendly
    expect(info.className).toContain("bg-line"); // neutre, pas couleur
    expect(info.group).toBe("workflow"); // fallback safe
  });

  it("fallback ne crash pas sur string vide", () => {
    expect(() => getStatusInfo("")).not.toThrow();
    expect(getStatusInfo("").label).toBe("");
  });
});

describe("orderStatus / labelToStatus", () => {
  it("inverse correctement les labels canoniques", () => {
    expect(labelToStatus("Brouillon")).toBe("draft");
    expect(labelToStatus("En production")).toBe("in_production");
    expect(labelToStatus("Annulée")).toBe("cancelled");
    expect(labelToStatus("En attente")).toBe("pending");
  });

  it("retourne le premier match si plusieurs statuts partagent un label (ex: 'Validée')", () => {
    // "Validée" est partagé entre `validated` (v1.1) et `approved` (legacy).
    // L'ordre déclaré dans ALL_ORDER_STATUSES place workflow avant legacy → `validated`.
    expect(labelToStatus("Validée")).toBe("validated");
  });

  it("retourne null pour label inconnu", () => {
    expect(labelToStatus("Statut Inexistant")).toBeNull();
    expect(labelToStatus("")).toBeNull();
  });
});
