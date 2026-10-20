"use client"

import { useEffect, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { toast, toastError } from "@/lib/toast"
import {
  fetchUserCloudAiSettings,
  updateUserCloudAiSettings,
} from "@/lib/user-cloud-ai-api"

/** 个人中心：云端 OpenAI 兼容接口（BYOK），替代服务端 .env 写死。 */
export function UserCloudAiSettingsPanel({ userId }: { userId: string }) {
  const [apiKeyDraft, setApiKeyDraft] = useState("")
  const [baseUrl, setBaseUrl] = useState("https://api.openai.com/v1")
  const [model, setModel] = useState("")
  const [hasStoredKey, setHasStoredKey] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const settings = await fetchUserCloudAiSettings(userId)
        if (cancelled) return
        setBaseUrl(settings.openAiBaseUrl)
        setModel(settings.openAiModel)
        setHasStoredKey(settings.hasApiKey)
        setApiKeyDraft("")
      } catch (error) {
        if (!cancelled) toastError(error, "加载云端 AI 配置失败")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [userId])

  async function handleSave() {
    setSaving(true)
    try {
      const patch: {
        openAiApiKey?: string
        openAiBaseUrl?: string
        openAiModel?: string
      } = {
        openAiBaseUrl: baseUrl.trim(),
        openAiModel: model.trim(),
      }
      if (apiKeyDraft.trim()) {
        patch.openAiApiKey = apiKeyDraft.trim()
      }
      const next = await updateUserCloudAiSettings(userId, patch)
      setHasStoredKey(next.hasApiKey)
      setApiKeyDraft("")
      toast.success("云端 AI 配置已保存")
    } catch (error) {
      toastError(error, "保存失败")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-[#78746C]">加载中…</p>
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-[#ECEAE4] bg-[#FCFCFB] p-5">
      <div>
        <h3 className="text-sm font-semibold text-[#242321]">云端 AI</h3>
        <p className="mt-1 text-xs text-[#78746C]">
          使用 OpenAI
          兼容接口（OpenAI、DeepSeek、火山方舟等）。密钥仅保存在你的账户下，用于服务端代发写作与对话请求。
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="user-openai-key">API Key</Label>
        <Input
          id="user-openai-key"
          type="password"
          autoComplete="off"
          value={apiKeyDraft}
          onChange={(event) => setApiKeyDraft(event.target.value)}
          placeholder={hasStoredKey ? "已配置，输入新 Key 可覆盖" : "sk-…"}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="user-openai-base">接口地址</Label>
        <Input
          id="user-openai-base"
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.target.value)}
          placeholder="https://api.openai.com/v1"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="user-openai-model">模型</Label>
        <Input
          id="user-openai-model"
          value={model}
          onChange={(event) => setModel(event.target.value)}
          placeholder="例如 gpt-4o-mini 或 deepseek-chat"
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={() => void handleSave()} disabled={saving}>
          {saving ? "保存中…" : "保存云端配置"}
        </Button>
      </div>
    </div>
  )
}
