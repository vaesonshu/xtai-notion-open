"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { PlusIcon, SearchIcon } from "@workspace/icons"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { toast, toastError } from "@/lib/toast"

import {
  createAdminUser,
  deleteAdminUser,
  fetchAdminUsers,
  updateAdminUser,
  type AdminUserRecord,
} from "@/lib/admin-api"
import { useAuth } from "../auth-provider"
import { AdminShell } from "./admin-shell"
import { formatAdminDateTime } from "./article-types"

type UserFormState = {
  email: string
  displayName: string
  password: string
  role: "user" | "admin"
}

const emptyForm: UserFormState = {
  email: "",
  displayName: "",
  password: "",
  role: "user",
}

export function UserManagementPage() {
  const auth = useAuth()
  const userId = auth.user?.id
  const [users, setUsers] = useState<AdminUserRecord[]>([])
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AdminUserRecord | null>(null)
  const [form, setForm] = useState<UserFormState>(emptyForm)
  const [busy, setBusy] = useState(false)

  const loadUsers = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const next = await fetchAdminUsers(userId)
      setUsers(next)
    } catch (error) {
      toastError(error, "加载用户失败")
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return users
    return users.filter(
      (user) =>
        user.email.toLowerCase().includes(keyword) ||
        user.displayName.toLowerCase().includes(keyword) ||
        user.id.toLowerCase().includes(keyword)
    )
  }, [query, users])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(user: AdminUserRecord) {
    setEditing(user)
    setForm({
      email: user.email,
      displayName: user.displayName,
      password: "",
      role: user.role,
    })
    setDialogOpen(true)
  }

  async function submitForm() {
    if (!userId) return
    if (!form.email.trim() || !form.displayName.trim()) {
      toast.error("请填写邮箱和显示名称")
      return
    }
    if (!editing && !form.password.trim()) {
      toast.error("新建用户需要设置密码")
      return
    }
    setBusy(true)
    try {
      if (editing) {
        await updateAdminUser(userId, editing.id, {
          email: form.email.trim(),
          displayName: form.displayName.trim(),
          role: form.role,
          ...(form.password.trim() ? { password: form.password } : {}),
        })
        toast.success("用户已更新")
      } else {
        await createAdminUser(userId, {
          email: form.email.trim(),
          displayName: form.displayName.trim(),
          password: form.password,
          role: form.role,
        })
        toast.success("用户已创建")
      }
      setDialogOpen(false)
      await loadUsers()
    } catch (error) {
      toastError(error, "保存失败")
    } finally {
      setBusy(false)
    }
  }

  async function removeUser(target: AdminUserRecord) {
    if (!userId) return
    if (!window.confirm(`确定删除用户 ${target.email}？`)) return
    setBusy(true)
    try {
      await deleteAdminUser(userId, target.id)
      toast.success("用户已删除")
      await loadUsers()
    } catch (error) {
      toastError(error, "删除失败")
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminShell>
      <header className="flex shrink-0 items-center justify-between">
        <div>
          <h1 className="text-[26px] font-bold text-[#183e31]">用户管理</h1>
          <p className="mt-[5px] text-[13px] text-[#718179]">
            管理平台用户账号与权限
          </p>
        </div>
        <Button
          type="button"
          className="h-auto gap-[7px] rounded-[7px] bg-[#167251] px-[14px] py-[10px] text-[13px] font-semibold text-white hover:bg-[#167251]"
          onClick={openCreate}
        >
          <PlusIcon className="size-[15px]" />
          新建用户
        </Button>
      </header>

      <div className="flex shrink-0 items-center gap-3">
        <label className="flex h-11 w-[320px] items-center gap-2 rounded-[7px] bg-white px-[11px] outline outline-[#e1e8e4]">
          <SearchIcon className="size-[15px] text-[#7e9087]" />
          <Input
            aria-label="搜索用户"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索邮箱、昵称或 ID"
            className="h-auto w-full border-0 bg-transparent p-0 text-[12px] text-[#53665c] shadow-none outline-none placeholder:text-[#9aa7a1] focus-visible:border-0 focus-visible:ring-0"
          />
        </label>
        <span className="ml-auto text-[12px] text-[#74857c]">
          共 {filtered.length} 位用户
        </span>
      </div>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[10px] bg-white outline outline-[#e6ebe8]">
        <div className="grid shrink-0 grid-cols-[minmax(180px,1.6fr)_minmax(120px,1fr)_90px_160px_160px_120px] items-center border-b border-[#e6ebe8] bg-[#f7faf8] px-4 py-3 text-[12px] font-semibold text-[#52645b]">
          <div>邮箱</div>
          <div>显示名称</div>
          <div>角色</div>
          <div>创建时间</div>
          <div>更新时间</div>
          <div>操作</div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-1 items-center justify-center text-[12px] text-[#74857c]">
              加载中…
            </div>
          ) : !filtered.length ? (
            <div className="flex flex-1 items-center justify-center text-[12px] text-[#74857c]">
              暂无用户
            </div>
          ) : (
            filtered.map((user) => (
              <div
                key={user.id}
                className="grid grid-cols-[minmax(180px,1.6fr)_minmax(120px,1fr)_90px_160px_160px_120px] items-center border-b border-[#edf0ee] px-4 py-3 last:border-0"
              >
                <div className="truncate text-[12px] text-[#29463a]">
                  {user.email}
                </div>
                <div className="flex min-w-0 items-center gap-2 text-[12px] text-[#52645b]">
                  <span
                    className="flex size-6 items-center justify-center rounded-full text-[10px] font-bold"
                    style={{
                      backgroundColor: `${user.color}22`,
                      color: user.color,
                    }}
                  >
                    {user.displayName.slice(0, 1)}
                  </span>
                  {user.displayName}
                </div>
                <div>
                  <span
                    className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                      user.role === "admin"
                        ? "bg-[#e8f5ee] text-[#17724f]"
                        : "bg-[#f3f4f3] text-[#5f6d66]"
                    }`}
                  >
                    {user.role === "admin" ? "管理员" : "用户"}
                  </span>
                </div>
                <div className="text-[12px] text-[#52645b]">
                  {formatAdminDateTime(user.createdAt)}
                </div>
                <div className="text-[12px] text-[#52645b]">
                  {formatAdminDateTime(user.updatedAt)}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => openEdit(user)}
                  >
                    编辑
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy || user.id === userId}
                    onClick={() => void removeUser(user)}
                  >
                    删除
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "编辑用户" : "新建用户"}</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="admin-user-email">邮箱</FieldLabel>
              <Input
                id="admin-user-email"
                type="email"
                autoComplete="off"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                placeholder="name@example.com"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="admin-user-display-name">
                显示名称
              </FieldLabel>
              <Input
                id="admin-user-display-name"
                autoComplete="off"
                value={form.displayName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    displayName: event.target.value,
                  }))
                }
                placeholder="用户昵称"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="admin-user-password">密码</FieldLabel>
              <Input
                id="admin-user-password"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                placeholder={editing ? "留空则不修改密码" : "设置登录密码"}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="admin-user-role">角色</FieldLabel>
              <Select
                items={[
                  { label: "普通用户", value: "user" },
                  { label: "管理员", value: "admin" },
                ]}
                value={form.role}
                onValueChange={(role) =>
                  setForm((current) => ({
                    ...current,
                    role: role === "admin" ? "admin" : "user",
                  }))
                }
              >
                <SelectTrigger id="admin-user-role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>角色</SelectLabel>
                    <SelectItem value="user">普通用户</SelectItem>
                    <SelectItem value="admin">管理员</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button disabled={busy} onClick={() => void submitForm()}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  )
}
