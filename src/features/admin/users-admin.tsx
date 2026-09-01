"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Pencil, Plus, ShieldOff, ShieldCheck } from "lucide-react";
import {
  createUserAction,
  resetPasswordAction,
  setUserDisabledAction,
  updateUserAction,
} from "@/server/actions/admin-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/status-badge";
import { ActionMenu } from "@/components/ui/menu";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { ROLE_LABELS, type Role } from "@/lib/roles";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  banned: boolean;
  propertyId: string | null;
  propertyName: string | null;
  createdAt: string;
}

interface PropertyOption {
  id: string;
  name: string;
}

export function UsersAdmin({ users, properties }: { users: UserRow[]; properties: PropertyOption[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editUser, setEditUser] = React.useState<UserRow | null>(null);
  const [resetUser, setResetUser] = React.useState<UserRow | null>(null);
  const [busy, setBusy] = React.useState(false);

  // Create form state
  const [cName, setCName] = React.useState("");
  const [cEmail, setCEmail] = React.useState("");
  const [cPassword, setCPassword] = React.useState("");
  const [cRole, setCRole] = React.useState<Role>("SITE_USER");
  const [cProperty, setCProperty] = React.useState(properties[0]?.id ?? "");

  // Edit form state
  const [eRole, setERole] = React.useState<Role>("SITE_USER");
  const [eProperty, setEProperty] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");

  async function createUser() {
    setBusy(true);
    const result = await createUserAction({
      name: cName,
      email: cEmail,
      password: cPassword,
      role: cRole,
      propertyId: cRole === "SITE_USER" ? cProperty || null : null,
    });
    setBusy(false);
    if (!result.ok) {
      toast("error", result.error);
      return;
    }
    toast("success", `User ${cEmail} created.`);
    setCreateOpen(false);
    setCName("");
    setCEmail("");
    setCPassword("");
    router.refresh();
  }

  async function saveEdit() {
    if (!editUser) return;
    setBusy(true);
    const result = await updateUserAction({
      userId: editUser.id,
      role: eRole,
      propertyId: eRole === "SITE_USER" ? eProperty || null : null,
    });
    setBusy(false);
    if (!result.ok) {
      toast("error", result.error);
      return;
    }
    toast("success", "User updated.");
    setEditUser(null);
    router.refresh();
  }

  async function toggleDisabled(user: UserRow) {
    const verb = user.banned ? "reactivate" : "disable";
    if (!window.confirm(`Really ${verb} ${user.email}?`)) return;
    const result = await setUserDisabledAction(user.id, !user.banned);
    if (!result.ok) {
      toast("error", result.error);
      return;
    }
    toast("success", `Account ${user.banned ? "reactivated" : "disabled"}.`);
    router.refresh();
  }

  async function doReset() {
    if (!resetUser) return;
    setBusy(true);
    const result = await resetPasswordAction(resetUser.id, newPassword);
    setBusy(false);
    if (!result.ok) {
      toast("error", result.error);
      return;
    }
    toast("success", `Password reset for ${resetUser.email}. Share it securely.`);
    setResetUser(null);
    setNewPassword("");
    router.refresh();
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button variant="primary" onClick={() => setCreateOpen(true)} data-testid="create-user-open">
          <Plus className="h-3.5 w-3.5" aria-hidden /> Create user
        </Button>
      </div>
      <Card className="overflow-hidden">
        {/* One card per account on phones; the six-column table from `sm` up. */}
        <ul className="divide-y divide-line sm:hidden" data-testid="users-cards">
          {users.map((u) => (
            <li key={u.id} className="flex items-start gap-3 px-3.5 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-bold text-ink">{u.name}</p>
                <p className="truncate font-mono text-[11.5px] text-muted">{u.email}</p>
                <p className="mt-1 text-[12px] text-muted">
                  {ROLE_LABELS[u.role as Role] ?? u.role}
                  {u.propertyName ? ` · ${u.propertyName}` : ""}
                </p>
                <div className="mt-1.5">
                  {u.banned ? (
                    <Badge tone="red" icon={ShieldOff} size="sm">
                      Disabled
                    </Badge>
                  ) : (
                    <Badge tone="green" icon={ShieldCheck} size="sm">
                      Active
                    </Badge>
                  )}
                </div>
              </div>
              <ActionMenu
                testId={`user-actions-mobile-${u.email}`}
                label={`Actions for ${u.email}`}
                items={[
                  {
                    label: "Edit role & property",
                    icon: Pencil,
                    onSelect: () => {
                      setEditUser(u);
                      setERole((u.role as Role) ?? "SITE_USER");
                      setEProperty(u.propertyId ?? properties[0]?.id ?? "");
                    },
                  },
                  { label: "Reset password", icon: KeyRound, onSelect: () => setResetUser(u) },
                  {
                    label: u.banned ? "Reactivate account" : "Disable account",
                    icon: u.banned ? ShieldCheck : ShieldOff,
                    danger: !u.banned,
                    onSelect: () => toggleDisabled(u),
                  },
                ]}
              />
            </li>
          ))}
        </ul>

        <div className="table-scroll hidden sm:block">
          <table className="z-table" data-testid="users-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Property</th>
                <th>Status</th>
                <th style={{ width: 90 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} data-testid={`user-row-${u.email}`}>
                  <td className="font-semibold">{u.name}</td>
                  <td className="font-mono text-xs">{u.email}</td>
                  <td>{ROLE_LABELS[u.role as Role] ?? u.role}</td>
                  <td>{u.propertyName ?? "—"}</td>
                  <td>
                    {u.banned ? (
                      <Badge tone="red" icon={ShieldOff}>Disabled</Badge>
                    ) : (
                      <Badge tone="green" icon={ShieldCheck}>Active</Badge>
                    )}
                  </td>
                  <td>
                    <ActionMenu
                      testId={`user-actions-${u.email}`}
                      label={`Actions for ${u.email}`}
                      items={[
                        {
                          label: "Edit role & property",
                          icon: Pencil,
                          onSelect: () => {
                            setEditUser(u);
                            setERole((u.role as Role) ?? "SITE_USER");
                            setEProperty(u.propertyId ?? properties[0]?.id ?? "");
                          },
                        },
                        { label: "Reset password", icon: KeyRound, onSelect: () => setResetUser(u) },
                        {
                          label: u.banned ? "Reactivate account" : "Disable account",
                          icon: u.banned ? ShieldCheck : ShieldOff,
                          danger: !u.banned,
                          onSelect: () => toggleDisabled(u),
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create */}
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create user"
        subtitle="Site users must be assigned to exactly one property. Share the initial password securely; the user can be given a new one at any time."
      >
        <div className="space-y-3.5">
          <div>
            <Label htmlFor="cu-name">Full name</Label>
            <Input id="cu-name" value={cName} onChange={(e) => setCName(e.target.value)} data-testid="cu-name" />
          </div>
          <div>
            <Label htmlFor="cu-email">Email</Label>
            <Input id="cu-email" type="email" value={cEmail} onChange={(e) => setCEmail(e.target.value)} data-testid="cu-email" />
          </div>
          <div>
            <Label htmlFor="cu-password">Initial password (min 10 chars)</Label>
            <Input id="cu-password" type="text" value={cPassword} onChange={(e) => setCPassword(e.target.value)} data-testid="cu-password" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cu-role">Role</Label>
              <Select id="cu-role" value={cRole} onChange={(e) => setCRole(e.target.value as Role)} data-testid="cu-role">
                <option value="SITE_USER">Site User</option>
                <option value="ASSISTANT_MANAGER">Assistant Manager</option>
                <option value="MANAGER_ADMIN">Manager / Admin</option>
              </Select>
            </div>
            {cRole === "SITE_USER" ? (
              <div>
                <Label htmlFor="cu-property">Assigned property</Label>
                <Select id="cu-property" value={cProperty} onChange={(e) => setCProperty(e.target.value)} data-testid="cu-property">
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
          </div>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={createUser} disabled={busy} data-testid="cu-submit">
              {busy ? "Creating…" : "Create user"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Edit */}
      <Dialog
        open={editUser !== null}
        onClose={() => setEditUser(null)}
        title={`Edit ${editUser?.email ?? ""}`}
      >
        <div className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="eu-role">Role</Label>
              <Select id="eu-role" value={eRole} onChange={(e) => setERole(e.target.value as Role)}>
                <option value="SITE_USER">Site User</option>
                <option value="ASSISTANT_MANAGER">Assistant Manager</option>
                <option value="MANAGER_ADMIN">Manager / Admin</option>
              </Select>
            </div>
            {eRole === "SITE_USER" ? (
              <div>
                <Label htmlFor="eu-property">Assigned property</Label>
                <Select id="eu-property" value={eProperty} onChange={(e) => setEProperty(e.target.value)}>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
          </div>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setEditUser(null)}>Cancel</Button>
            <Button variant="primary" onClick={saveEdit} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Reset password */}
      <Dialog
        open={resetUser !== null}
        onClose={() => setResetUser(null)}
        title={`Reset password — ${resetUser?.email ?? ""}`}
        subtitle="All existing sessions for the user are revoked."
      >
        <div className="space-y-3.5">
          <div>
            <Label htmlFor="rp-password">New password (min 10 chars)</Label>
            <Input id="rp-password" type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setResetUser(null)}>Cancel</Button>
            <Button variant="primary" onClick={doReset} disabled={busy || newPassword.length < 10}>
              {busy ? "Resetting…" : "Reset password"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
