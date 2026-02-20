"use client";

import { useState, useCallback } from "react";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@repo/design-system/components/ui/alert-dialog";
import {
  Loader2Icon,
  PlusIcon,
  TrashIcon,
  KeyIcon,
  ShieldIcon,
} from "lucide-react";
import {
  useGetSecretsQuery,
  useUpsertSecretMutation,
  useDeleteSecretMutation,
} from "@/lib/store/api/api.slice";
import { toast } from "sonner";

export function SecretsTab() {
  const { data: secrets, isLoading, error } = useGetSecretsQuery();
  const [upsertSecret, { isLoading: isUpserting }] = useUpsertSecretMutation();
  const [deleteSecret] = useDeleteSecretMutation();

  // New secret form
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const handleAdd = useCallback(async () => {
    if (!newKey.trim() || !newValue.trim()) {
      toast.error("Both key and value are required");
      return;
    }

    // Validate env var format
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(newKey)) {
      toast.error("Key must be a valid environment variable name (e.g., MY_API_KEY)");
      return;
    }

    try {
      const result = await upsertSecret({
        key: newKey.trim(),
        value: newValue.trim(),
        description: newDescription.trim() || undefined,
      }).unwrap();

      toast.success(result.updated ? `Updated ${newKey}` : `Added ${newKey}`);
      setNewKey("");
      setNewValue("");
      setNewDescription("");
      setShowAddForm(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : typeof err === "object" && err && "data" in err ? String((err as { data: unknown }).data) : "Failed to save secret";
      toast.error(message);
    }
  }, [newKey, newValue, newDescription, upsertSecret]);

  const handleDelete = useCallback(async (id: string, key: string) => {
    try {
      await deleteSecret({ id }).unwrap();
      toast.success(`Deleted ${key}`);
    } catch {
      toast.error("Failed to delete secret");
    }
  }, [deleteSecret]);

  if (error) {
    return (
      <div className="text-sm text-destructive">
        Failed to load secrets. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold">Secrets</h3>
        <p className="text-sm text-muted-foreground">
          Environment variables that are automatically injected into every sandbox session.
          These are available as env vars in your terminal and in your code.
        </p>
      </div>

      {/* Info card */}
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="flex items-start gap-3 pt-4 pb-4">
          <ShieldIcon className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
          <div className="text-sm text-muted-foreground">
            <p>Secrets are encrypted at rest and only decrypted when injected into your sandbox.</p>
            <p className="mt-1">
              They are written to <code className="text-xs bg-muted px-1 py-0.5 rounded">~/.user_env</code> and
              sourced by every shell session automatically.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Secrets list */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base">Your Secrets</CardTitle>
            <CardDescription>
              {isLoading
                ? "Loading..."
                : `${secrets?.length ?? 0} secret${(secrets?.length ?? 0) === 1 ? "" : "s"} configured`}
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => setShowAddForm(!showAddForm)}
            disabled={isUpserting}
          >
            <PlusIcon className="h-4 w-4 mr-1" />
            Add Secret
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Add form */}
          {showAddForm && (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="secret-key" className="text-xs">
                    Key
                  </Label>
                  <Input
                    id="secret-key"
                    placeholder="MY_API_KEY"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"))}
                    className="font-mono text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="secret-value" className="text-xs">
                    Value
                  </Label>
                  <Input
                    id="secret-value"
                    type="password"
                    placeholder="sk-..."
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="secret-desc" className="text-xs">
                  Description (optional)
                </Label>
                <Input
                  id="secret-desc"
                  placeholder="What this secret is used for"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewKey("");
                    setNewValue("");
                    setNewDescription("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleAdd}
                  disabled={isUpserting || !newKey || !newValue}
                >
                  {isUpserting && <Loader2Icon className="h-3 w-3 mr-1 animate-spin" />}
                  Save
                </Button>
              </div>
            </div>
          )}

          {/* Secret rows */}
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-muted/30 rounded animate-pulse" />
              ))}
            </div>
          ) : secrets && secrets.length > 0 ? (
            secrets.map((secret) => (
              <div
                key={secret.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <KeyIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="font-mono text-sm font-medium truncate">
                      {secret.key}
                    </div>
                    {secret.description && (
                      <div className="text-xs text-muted-foreground truncate">
                        {secret.description}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <span className="text-xs text-muted-foreground font-mono">
                    {secret.maskedValue}
                  </span>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <TrashIcon className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete secret</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete <code className="font-mono">{secret.key}</code>?
                          This will remove it from all future sandbox sessions.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(secret.id, secret.key)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No secrets configured yet. Add your first secret to get started.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
