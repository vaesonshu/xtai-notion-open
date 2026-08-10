import { ArrowUpRightIcon } from "@workspace/icons"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Separator } from "@workspace/ui/components/separator"
import { PencilIcon } from "./icon"
export function DocumentCanvas() {
  return (
    <section className="flex min-h-0 flex-1 justify-center overflow-auto px-[72px] pt-[58px] pb-[72px]">
      <article className="flex w-[720px] max-w-full flex-col gap-6">
        <div className="flex items-center justify-between">
          <span className="rounded-md bg-[#FFF0ED] px-[9px] py-[5px] text-[11px] font-semibold text-[#B53B30]">
            ● 产品策略
          </span>
          <span className="text-[11px] text-[#96918A]">
            今天 14:32 · 3 人协作
          </span>
        </div>
        <h1 className="text-[42px] leading-[1.2] font-bold">
          让知识真正流动起来
        </h1>
        <p className="text-[17px] leading-[1.65] text-[#74706A]">
          我们正在构建一个更轻、更聪明的团队知识工作台。这里不是文件的终点，而是想法开始互相连接的地方。
        </p>
        <Alert className="gap-3.5 border-[#D8EDE6] bg-[#F0F8F5] p-4">
          <div className="flex size-[30px] items-center justify-center rounded-[7px] bg-[#24866B] text-white">
            ✦
          </div>
          <div>
            <AlertTitle className="text-[13px] text-[#185F4D]">
              Flow AI 发现了 3 个相关上下文
            </AlertTitle>
            <AlertDescription className="text-xs leading-[1.5] text-[#4D766B]">
              「用户研究 / Q2
              访谈」与这段内容高度相关，点击即可插入摘要或建立双向链接。
            </AlertDescription>
          </div>
          <PencilIcon icon={ArrowUpRightIcon} color="#24866B" size={16} />
        </Alert>
        <section className="flex flex-col gap-[13px]">
          <h2 className="text-[21px] font-bold text-[#2D2B28]">
            01&nbsp;&nbsp;为什么现在需要它
          </h2>
          <p className="text-[15px] leading-[1.75] text-[#55514C]">
            信息散落在会议、聊天和无数页面里。传统知识库擅长存储，却很少帮助团队理解信息之间的关系。我们的目标，是让每一次记录都能自动进入团队的知识网络。
          </p>
          <blockquote className="flex h-[68px] gap-3.5 py-1">
            <span className="w-[3px] rounded-sm bg-[#E64B3C]" />
            <span className="text-[18px] leading-[1.65] text-[#3B3834] italic">
              “好的知识工具不应该要求人整理一切，而应该让秩序在工作中自然出现。”
            </span>
          </blockquote>
        </section>
        <Separator />
        <section className="flex flex-col gap-2.5">
          <h3 className="text-sm font-semibold text-[#34312E]">接下来</h3>
          {[
            ["完成核心编辑体验原型", true],
            ["邀请设计与工程团队评审", false],
            ["连接用户研究知识库", false],
          ].map(([label, done]) => (
            <label
              key={label as string}
              className="flex items-center gap-2.5 text-sm"
            >
              <Checkbox checked={done as boolean} />
              <span className={done ? "text-[#98938C]" : "text-[#4D4944]"}>
                {label as string}
              </span>
            </label>
          ))}
        </section>
      </article>
    </section>
  )
}
