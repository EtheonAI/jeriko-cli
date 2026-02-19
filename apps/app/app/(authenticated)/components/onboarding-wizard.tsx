"use client";

import { useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@repo/design-system/components/ui/dialog";
import { Button } from "@repo/design-system/components/ui/button";
import {
  CodeIcon,
  PaletteIcon,
  SearchIcon,
  TrendingUpIcon,
  GraduationCapIcon,
  BriefcaseIcon,
  UserIcon,
  SparklesIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  CheckIcon,
  UsersIcon,
  BuildingIcon,
} from "lucide-react";
import { cn } from "@repo/design-system/lib/utils";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  setCurrentStep,
  goToNextStep,
  goToPreviousStep,
  setPersona,
  setUserType,
  toggleInterest,
  completeOnboarding,
  type OnboardingStep,
  type UserPersona,
  type UserType,
} from "@/lib/store/slices/onboarding.slice";

// ---------------------------------------------------------------------------
// Step configurations
// ---------------------------------------------------------------------------

const PERSONA_OPTIONS: { value: UserPersona; label: string; icon: typeof CodeIcon; description: string }[] = [
  { value: "developer", label: "Developer", icon: CodeIcon, description: "Build apps and write code" },
  { value: "designer", label: "Designer", icon: PaletteIcon, description: "Create visuals and UI" },
  { value: "researcher", label: "Researcher", icon: SearchIcon, description: "Find information and analyze" },
  { value: "marketer", label: "Marketer", icon: TrendingUpIcon, description: "Campaigns and content" },
  { value: "analyst", label: "Analyst", icon: TrendingUpIcon, description: "Data and insights" },
  { value: "student", label: "Student", icon: GraduationCapIcon, description: "Learning and projects" },
  { value: "business", label: "Business", icon: BriefcaseIcon, description: "Operations and strategy" },
  { value: "other", label: "Other", icon: UserIcon, description: "Something else entirely" },
];

const USER_TYPE_OPTIONS: { value: UserType; label: string; icon: typeof UserIcon; description: string }[] = [
  { value: "individual", label: "Just me", icon: UserIcon, description: "Personal use" },
  { value: "team", label: "Small team", icon: UsersIcon, description: "2-20 people" },
  { value: "enterprise", label: "Enterprise", icon: BuildingIcon, description: "Large organization" },
];

const INTEREST_OPTIONS = [
  "Web development",
  "Data analysis",
  "Content writing",
  "Research",
  "Design & UI",
  "Automation",
  "Email management",
  "File management",
  "Code review",
  "Presentations",
  "Marketing",
  "Customer support",
];

const STEPS: OnboardingStep[] = ["welcome", "persona", "interests", "complete"];
const STEP_COUNT = STEPS.length;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OnboardingWizard() {
  const dispatch = useAppDispatch();
  const currentStep = useAppSelector((s) => s.onboarding.currentStep);
  const isCompleted = useAppSelector((s) => s.onboarding.isCompleted);
  const persona = useAppSelector((s) => s.onboarding.persona);
  const userType = useAppSelector((s) => s.onboarding.userType);
  const interests = useAppSelector((s) => s.onboarding.interests);

  // Check if onboarding should show (first login: no step set and not completed)
  const user = useAppSelector((s) => s.auth.user);
  const configsInitialized = useAppSelector((s) => s.configs.isInitialized);

  useEffect(() => {
    if (!user || !configsInitialized || isCompleted) return;
    // Check localStorage flag
    const dismissed = localStorage.getItem("rubic-onboarding-completed");
    if (dismissed === "true") return;
    // Open onboarding on first visit
    if (currentStep === null) {
      dispatch(setCurrentStep("welcome"));
    }
  }, [user, configsInitialized, isCompleted, currentStep, dispatch]);

  const handleComplete = useCallback(() => {
    dispatch(completeOnboarding());
    localStorage.setItem("rubic-onboarding-completed", "true");
  }, [dispatch]);

  const handleClose = useCallback(() => {
    // User dismissed — mark as completed
    handleComplete();
  }, [handleComplete]);

  const stepIndex = currentStep ? STEPS.indexOf(currentStep) : -1;
  const isOpen = currentStep !== null && !isCompleted;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="sm:max-w-lg gap-0 p-0 overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((stepIndex + 1) / STEP_COUNT) * 100}%` }}
          />
        </div>

        <div className="p-6">
          {/* Welcome */}
          {currentStep === "welcome" && (
            <>
              <DialogHeader className="text-center pb-4">
                <div className="mx-auto flex items-center justify-center size-12 rounded-full bg-primary/10 mb-3">
                  <SparklesIcon className="size-6 text-primary" />
                </div>
                <DialogTitle className="text-xl">Welcome to Rubic</DialogTitle>
                <DialogDescription>
                  Let&apos;s personalize your experience. This takes about 30 seconds.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 mt-2">
                <p className="text-sm text-muted-foreground text-center">How will you be using Rubic?</p>
                <div className="grid grid-cols-3 gap-2">
                  {USER_TYPE_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const selected = userType === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => dispatch(setUserType(opt.value))}
                        className={cn(
                          "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-colors",
                          selected ? "border-primary bg-primary/5" : "hover:bg-accent/50"
                        )}
                      >
                        <Icon className={cn("size-5", selected ? "text-primary" : "text-muted-foreground")} />
                        <span className="text-sm font-medium">{opt.label}</span>
                        <span className="text-xs text-muted-foreground">{opt.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <Button onClick={() => dispatch(goToNextStep())} className="gap-1">
                  Continue <ChevronRightIcon className="size-4" />
                </Button>
              </div>
            </>
          )}

          {/* Persona */}
          {currentStep === "persona" && (
            <>
              <DialogHeader className="pb-4">
                <DialogTitle>What describes you best?</DialogTitle>
                <DialogDescription>This helps Rubic suggest relevant tools and examples.</DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-2">
                {PERSONA_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const selected = persona === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => dispatch(setPersona(opt.value))}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                        selected ? "border-primary bg-primary/5" : "hover:bg-accent/50"
                      )}
                    >
                      <Icon className={cn("size-4 shrink-0", selected ? "text-primary" : "text-muted-foreground")} />
                      <div>
                        <p className="text-sm font-medium">{opt.label}</p>
                        <p className="text-xs text-muted-foreground">{opt.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-between mt-6">
                <Button variant="ghost" onClick={() => dispatch(goToPreviousStep())} className="gap-1">
                  <ChevronLeftIcon className="size-4" /> Back
                </Button>
                <Button onClick={() => dispatch(goToNextStep())} className="gap-1">
                  Continue <ChevronRightIcon className="size-4" />
                </Button>
              </div>
            </>
          )}

          {/* Interests */}
          {currentStep === "interests" && (
            <>
              <DialogHeader className="pb-4">
                <DialogTitle>What will you use Rubic for?</DialogTitle>
                <DialogDescription>Select all that apply. You can change these later.</DialogDescription>
              </DialogHeader>

              <div className="flex flex-wrap gap-2">
                {INTEREST_OPTIONS.map((interest) => {
                  const selected = interests.includes(interest);
                  return (
                    <button
                      key={interest}
                      type="button"
                      onClick={() => dispatch(toggleInterest(interest))}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                        selected ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent/50"
                      )}
                    >
                      {selected && <CheckIcon className="size-3" />}
                      {interest}
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-between mt-6">
                <Button variant="ghost" onClick={() => dispatch(goToPreviousStep())} className="gap-1">
                  <ChevronLeftIcon className="size-4" /> Back
                </Button>
                <Button onClick={() => dispatch(goToNextStep())} className="gap-1">
                  Continue <ChevronRightIcon className="size-4" />
                </Button>
              </div>
            </>
          )}

          {/* Complete */}
          {currentStep === "complete" && (
            <>
              <DialogHeader className="text-center pb-4">
                <div className="mx-auto flex items-center justify-center size-12 rounded-full bg-green-500/10 mb-3">
                  <CheckIcon className="size-6 text-green-500" />
                </div>
                <DialogTitle className="text-xl">You&apos;re all set!</DialogTitle>
                <DialogDescription>
                  Rubic is ready. Start a conversation or explore the features.
                </DialogDescription>
              </DialogHeader>

              <div className="flex justify-center mt-4">
                <Button onClick={handleComplete} className="gap-1">
                  Get started <ChevronRightIcon className="size-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
