"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "../hooks";
import {
  setUserAddedSkills,
  setOfficialSkills,
  toggleSkillEnabled,
  setSkillsLoading,
  setSkillsError,
  type Skill,
} from "../slices/skills.slice";
import { getTrpcClient } from "@/lib/trpc/vanilla";

export function useSkillsData({ autoFetch = false }: { autoFetch?: boolean } = {}) {
  const dispatch = useAppDispatch();
  const skills = useAppSelector((state) => state.skills);
  const hasFetchedRef = useRef(false);

  const fetchSkills = useCallback(async () => {
    dispatch(setSkillsLoading(true));
    try {
      const prefs = await getTrpcClient().user.getPreferences.query();
      const enabledSkills = (prefs as any)?.enabledSkills ?? {};
      // Skills are currently hardcoded in the UI — when backend is ready,
      // this will fetch from a dedicated skills endpoint.
      // For now, just set enabled state from preferences.
      const existing = [...skills.officialSkills, ...skills.userAddedSkills];
      if (existing.length > 0) {
        const updated = existing.map((s) => ({
          ...s,
          isEnabled: enabledSkills[s.id] ?? s.isEnabled,
        }));
        const official = updated.filter((s) => s.isOfficial);
        const user = updated.filter((s) => !s.isOfficial);
        if (official.length > 0) dispatch(setOfficialSkills(official));
        if (user.length > 0) dispatch(setUserAddedSkills(user));
      }
      hasFetchedRef.current = true;
    } catch (err: any) {
      dispatch(setSkillsError(err?.message || "Failed to load skills"));
    }
  }, [dispatch, skills.officialSkills, skills.userAddedSkills]);

  const toggleSkill = useCallback(
    async (id: string, isOfficial: boolean) => {
      dispatch(toggleSkillEnabled({ id, isOfficial }));
      try {
        const all = [...skills.officialSkills, ...skills.userAddedSkills];
        const skill = all.find((s) => s.id === id);
        const newEnabled = !(skill?.isEnabled ?? false);
        const prefs = await getTrpcClient().user.getPreferences.query();
        const enabledSkills = { ...((prefs as any)?.enabledSkills ?? {}), [id]: newEnabled };
        await getTrpcClient().user.updatePreferences.mutate({ enabledSkills } as any);
      } catch {
        // Revert
        dispatch(toggleSkillEnabled({ id, isOfficial }));
      }
    },
    [dispatch, skills.officialSkills, skills.userAddedSkills]
  );

  useEffect(() => {
    if (!autoFetch || hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    fetchSkills();
  }, [autoFetch, fetchSkills]);

  return {
    ...skills,
    fetchSkills,
    toggleSkill,
  };
}
