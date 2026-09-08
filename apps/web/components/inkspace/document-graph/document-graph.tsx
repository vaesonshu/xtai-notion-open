"use client"

import "@xyflow/react/dist/style.css"

import {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Controls,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeMouseHandler,
  ReactFlow,
} from "@xyflow/react"
import * as d3 from "d3-force"
import { LoaderCircleIcon } from "@workspace/icons"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast, toastError } from "@/lib/toast"
import { apiRequest } from "@/lib/api-client"
import { DocumentGraphEdge } from "./graph-edge"
import { DocumentGraphNode } from "./graph-node"

type GraphDocument = {
  id: string
  title: string
  links: string[]
}

const nodeTypes = { graph: DocumentGraphNode }
const edgeTypes = { graph: DocumentGraphEdge }

type ForceNode = Node & { x?: number; y?: number }

/** 从后端拉取 @mention 关系并用力导向布局渲染文档图谱。 */
export function DocumentGraph({
  apiUrl,
  userId,
}: {
  apiUrl: string
  userId: string
}) {
  const router = useRouter()
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [loading, setLoading] = useState(true)
  const simulationDone = useRef(false)

  useEffect(() => {
    let cancelled = false
    let stopSimulation: (() => void) | undefined
    simulationDone.current = false
    setLoading(true)

    void apiRequest({
      path: "/documents/graph",
      userId,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`加载图谱失败 (${response.status})`)
        return response.json() as Promise<GraphDocument[]>
      })
      .then((documents) => {
        if (cancelled) return

        if (documents.length === 0) {
          setNodes([])
          setEdges([])
          setLoading(false)
          return
        }

        const indexById = new Map(
          documents.map((document, index) => [document.id, index])
        )
        const initialNodes: ForceNode[] = documents.map((document) => ({
          id: document.id,
          type: "graph",
          data: { title: document.title },
          width: 100,
          height: 100,
          position: { x: 0, y: 0 },
        }))

        const initialLinks: Array<{
          source: number
          target: number
        }> = []
        for (const [index, document] of documents.entries()) {
          for (const linkId of document.links ?? []) {
            const targetIndex = indexById.get(linkId)
            if (targetIndex === undefined) continue
            initialLinks.push({ source: index, target: targetIndex })
          }
        }

        // 必须在 forceSimulation 之前构建边：d3 会把 link.source/target 从索引
        // 改成节点对象引用，之后再按索引取节点会得到 undefined。
        const flowEdges: Edge[] = initialLinks.flatMap((link, edgeIndex) => {
          const sourceNode = initialNodes[link.source]
          const targetNode = initialNodes[link.target]
          if (!sourceNode || !targetNode) return []
          return [
            {
              id: `edge-${edgeIndex}`,
              type: "graph",
              source: sourceNode.id,
              target: targetNode.id,
            },
          ]
        })
        setEdges(flowEdges)

        const simulation = d3
          .forceSimulation(initialNodes)
          .force("charge", d3.forceManyBody().strength(-50))
          .force("collide", d3.forceCollide(80))
          .force(
            "link",
            d3.forceLink(initialLinks).strength(1).distance(200).iterations(100)
          )
          .force("center", d3.forceCenter(700, 400))
          .force("radial", d3.forceRadial(0, 700, 400))

        stopSimulation = () => simulation.stop()

        simulation.on("end", () => {
          simulationDone.current = true
          setLoading(false)
        })

        simulation.on("tick", () => {
          const forceNodes = simulation.nodes().map((node: ForceNode) => ({
            ...node,
            position: { x: node.x ?? 0, y: node.y ?? 0 },
          }))
          setNodes(forceNodes)
        })
      })
      .catch((error) => {
        if (!cancelled) {
          toastError(error, "加载文档图谱失败")
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
      stopSimulation?.()
    }
  }, [apiUrl, userId])

  const selectNode = useCallback((nodeId: string) => {
    setNodes((current) =>
      current.map((item) => ({ ...item, selected: item.id === nodeId }))
    )
    setEdges((current) =>
      current.map((edge) => ({
        ...edge,
        selected: edge.source === nodeId || edge.target === nodeId,
      }))
    )
  }, [])

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      selectNode(node.id)
    },
    [selectNode]
  )

  const handleNodeDoubleClick: NodeMouseHandler = useCallback(
    (_, node) => {
      router.push(`/documents/${node.id}`)
    },
    [router]
  )

  const onNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setNodes((current) => applyNodeChanges(changes, current)),
    []
  )
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) =>
      setEdges((current) => applyEdgeChanges(changes, current)),
    []
  )

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-[#E8E6E1] px-6 py-4">
        <h1 className="text-lg font-semibold text-[#242321]">文档图谱</h1>
        <span className="text-xs text-[#78746C]">
          基于文档内 @提及 引用关系 · 双击节点打开文档
        </span>
      </div>
      <div className="relative min-h-0 flex-1">
        {loading && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center bg-[#FCFCFA]/60"
            role="status"
          >
            <div className="flex flex-col items-center gap-2 text-[#78746C]">
              <LoaderCircleIcon className="size-8 animate-spin" />
              <p className="text-sm">布局计算中…</p>
            </div>
          </div>
        )}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodesDraggable
          proOptions={{ hideAttribution: true }}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          onNodeDragStart={(_, node) => selectNode(node.id)}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
        >
          <Background color="#E8E6E1" gap={20} />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  )
}
