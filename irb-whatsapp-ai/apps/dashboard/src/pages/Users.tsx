import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Pencil, Shield, UserCog, UserPlus, XCircle } from 'lucide-react';
import { api } from '../services/api';

interface AccessScope {
  allCostCenters: boolean;
  costCenterIds: string[];
  units: string[];
}

interface PermissionOverrides {
  allow: string[];
  deny: string[];
}

interface UserData {
  id: string;
  email: string;
  name: string;
  role: string;
  department: string | null;
  jobTitle: string | null;
  managerName: string | null;
  accessProfile: string;
  permissionOverrides: PermissionOverrides;
  accessScope: AccessScope;
  permissions: string[];
  isActive: boolean;
  createdAt: string;
}

interface ProfileOption {
  key: string;
  label: string;
  permissions: string[];
}

interface CostCenterOption {
  id: string;
  code: string | null;
  name: string;
}

const EMPTY_FORM = {
  name: '',
  email: '',
  password: '',
  role: 'attendant',
  department: '',
  jobTitle: '',
  managerName: '',
  accessProfile: 'attendant_basic',
  permissionOverrides: { allow: [] as string[], deny: [] as string[] },
  accessScope: { allCostCenters: true, costCenterIds: [] as string[], units: [] as string[] },
};

function Surface({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60">
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

export default function Users() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [permissionGroups, setPermissionGroups] = useState<Record<string, string[]>>({});
  const [costCenters, setCostCenters] = useState<CostCenterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [usersResponse, accessModel] = await Promise.all([api.getUsers(), api.getAccessModel()]);
      setUsers(usersResponse.users);
      setProfiles(accessModel.profiles);
      setPermissionGroups(accessModel.permissionGroups);
      setCostCenters(accessModel.costCenters);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.key === form.accessProfile),
    [form.accessProfile, profiles],
  );

  const effectivePermissions = useMemo(() => {
    const base = new Set(selectedProfile?.permissions || []);
    form.permissionOverrides.deny.forEach((permission) => base.delete(permission));
    form.permissionOverrides.allow.forEach((permission) => base.add(permission));
    return Array.from(base).sort();
  }, [form.permissionOverrides, selectedProfile]);

  const openCreate = () => {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setError('');
    setShowModal(true);
  };

  const openEdit = (user: UserData) => {
    setEditingUser(user);
    setForm({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      department: user.department || '',
      jobTitle: user.jobTitle || '',
      managerName: user.managerName || '',
      accessProfile: user.accessProfile,
      permissionOverrides: {
        allow: user.permissionOverrides?.allow || [],
        deny: user.permissionOverrides?.deny || [],
      },
      accessScope: {
        allCostCenters: user.accessScope?.allCostCenters !== false,
        costCenterIds: user.accessScope?.costCenterIds || [],
        units: user.accessScope?.units || [],
      },
    });
    setError('');
    setShowModal(true);
  };

  const toggleArrayValue = (current: string[], value: string) =>
    current.includes(value) ? current.filter((item) => item !== value) : [...current, value];

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name,
        email: form.email,
        role: form.role,
        department: form.department || undefined,
        jobTitle: form.jobTitle || undefined,
        managerName: form.managerName || undefined,
        accessProfile: form.accessProfile,
        permissionOverrides: form.permissionOverrides,
        accessScope: form.accessScope,
        ...(form.password ? { password: form.password } : {}),
      };

      if (editingUser) {
        await api.updateUser(editingUser.id, payload);
      } else {
        if (!form.password) {
          setError('Senha obrigatória para novo colaborador');
          setSaving(false);
          return;
        }
        await api.createUser(payload as any);
      }

      setShowModal(false);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (user: UserData) => {
    await api.updateUser(user.id, { isActive: !user.isActive });
    await load();
  };

  if (loading) {
    return <div className="px-6 py-6 text-sm text-slate-500">Carregando colaboradores e acessos...</div>;
  }

  return (
    <div className="space-y-6 px-6 py-6">
      <section className="overflow-hidden rounded-[28px] border border-slate-900 bg-slate-950 text-white shadow-2xl shadow-slate-950/15">
        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.35fr_0.95fr] lg:px-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300/80">Colaboradores e Acessos</p>
            <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight">Cadastro do colaborador com perfil, permissões e escopo operacional.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              O sistema agora suporta perfil de acesso, exceções por permissão e escopo por centro de custo.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Colaboradores</p>
              <p className="mt-2 text-2xl font-semibold">{users.length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Perfis</p>
              <p className="mt-2 text-2xl font-semibold">{profiles.length}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          <UserPlus size={18} />
          Novo colaborador
        </button>
      </div>

      <Surface title="Equipe cadastrada" subtitle="Visão consolidada de perfil, escopo e estado de acesso.">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.18em] text-slate-400">
                <th className="pb-3 pr-4 font-medium">Colaborador</th>
                <th className="pb-3 pr-4 font-medium">Perfil</th>
                <th className="pb-3 pr-4 font-medium">Área</th>
                <th className="pb-3 pr-4 font-medium">Escopo</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="py-3 pr-4">
                    <div>
                      <p className="font-medium text-slate-900">{user.name}</p>
                      <p className="text-xs text-slate-500">{user.email}</p>
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 ring-1 ring-sky-200">
                        <UserCog size={12} />
                        {profiles.find((profile) => profile.key === user.accessProfile)?.label || user.accessProfile}
                      </span>
                      {user.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 ring-1 ring-violet-200">
                          <Shield size={12} />
                          Admin
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-slate-500">{user.department || user.jobTitle || '-'}</td>
                  <td className="py-3 pr-4 text-slate-500">
                    {user.accessScope?.allCostCenters ? 'Todos os centros' : `${user.accessScope?.costCenterIds?.length || 0} centros liberados`}
                  </td>
                  <td className="py-3 pr-4">
                    <button
                      onClick={() => toggleActive(user)}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
                        user.isActive
                          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                          : 'bg-rose-50 text-rose-700 ring-rose-200'
                      }`}
                    >
                      {user.isActive ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      {user.isActive ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                  <td className="py-3 text-right">
                    <button
                      onClick={() => openEdit(user)}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
                    >
                      <Pencil size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Surface>

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{editingUser ? 'Editar colaborador' : 'Novo colaborador'}</h2>
                <p className="mt-1 text-sm text-slate-500">Defina identidade, perfil, permissões e escopo do acesso.</p>
              </div>
              <button onClick={() => setShowModal(false)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600">
                Fechar
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-6">
              {error ? <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">Nome</span>
                  <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none" required />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">Email</span>
                  <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none" required />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">Senha</span>
                  <input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none" placeholder={editingUser ? 'Manter atual' : ''} />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">Papel técnico</span>
                  <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none">
                    <option value="attendant">Padrão</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">Departamento</span>
                  <input value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none" />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">Cargo</span>
                  <input value={form.jobTitle} onChange={(event) => setForm({ ...form, jobTitle: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none" />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">Gestor</span>
                  <input value={form.managerName} onChange={(event) => setForm({ ...form, managerName: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none" />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">Perfil de acesso</span>
                  <select value={form.accessProfile} onChange={(event) => setForm({ ...form, accessProfile: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none">
                    {profiles.map((profile) => (
                      <option key={profile.key} value={profile.key}>{profile.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
                <Surface title="Exceções de permissão" subtitle="Permissões extras liberadas ou bloqueadas além do perfil base.">
                  <div className="space-y-5">
                    {Object.entries(permissionGroups).map(([group, permissions]) => (
                      <div key={group}>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{group}</p>
                        <div className="grid gap-2 md:grid-cols-2">
                          {permissions.map((permission) => (
                            <div key={permission} className="rounded-2xl border border-slate-200 p-3">
                              <p className="text-sm font-medium text-slate-900">{permission}</p>
                              <div className="mt-2 flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setForm({
                                    ...form,
                                    permissionOverrides: {
                                      allow: toggleArrayValue(form.permissionOverrides.allow, permission),
                                      deny: form.permissionOverrides.deny.filter((item) => item !== permission),
                                    },
                                  })}
                                  className={`rounded-full px-3 py-1 text-xs font-medium ${form.permissionOverrides.allow.includes(permission) ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700'}`}
                                >
                                  Liberar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setForm({
                                    ...form,
                                    permissionOverrides: {
                                      allow: form.permissionOverrides.allow.filter((item) => item !== permission),
                                      deny: toggleArrayValue(form.permissionOverrides.deny, permission),
                                    },
                                  })}
                                  className={`rounded-full px-3 py-1 text-xs font-medium ${form.permissionOverrides.deny.includes(permission) ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700'}`}
                                >
                                  Bloquear
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </Surface>

                <div className="space-y-6">
                  <Surface title="Escopo" subtitle="Defina se o colaborador pode operar em todos os centros ou só em alguns.">
                    <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={form.accessScope.allCostCenters}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            accessScope: {
                              ...form.accessScope,
                              allCostCenters: event.target.checked,
                              costCenterIds: event.target.checked ? [] : form.accessScope.costCenterIds,
                            },
                          })
                        }
                      />
                      Liberar todos os centros de custo
                    </label>

                    {!form.accessScope.allCostCenters ? (
                      <div className="mt-4 grid gap-2 md:grid-cols-2">
                        {costCenters.map((center) => (
                          <label key={center.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={form.accessScope.costCenterIds.includes(center.id)}
                              onChange={() =>
                                setForm({
                                  ...form,
                                  accessScope: {
                                    ...form.accessScope,
                                    costCenterIds: toggleArrayValue(form.accessScope.costCenterIds, center.id),
                                  },
                                })
                              }
                            />
                            <span>{center.code ? `${center.code} · ` : ''}{center.name}</span>
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </Surface>

                  <Surface title="Resultado efetivo" subtitle="Resumo do que o colaborador realmente poderá acessar.">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                      <p className="text-sm font-medium text-slate-900">{selectedProfile?.label || form.accessProfile}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {form.accessScope.allCostCenters ? 'Todos os centros de custo liberados.' : `${form.accessScope.costCenterIds.length} centros de custo liberados.`}
                      </p>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {effectivePermissions.map((permission) => (
                        <span key={permission} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                          {permission}
                        </span>
                      ))}
                    </div>
                  </Surface>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60">
                  {saving ? 'Salvando...' : 'Salvar acesso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
