import { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import { useGraphStore } from "../../store/graphStore";
import { useUIStore } from "../../store/uiStore";
import { useLayerColors } from "../../hooks/useLayerColors";
import type { Node } from "../../types";
import { Plus, ArrowUpDown } from "lucide-react";

const columnHelper = createColumnHelper<Node>();

export function NodeTable() {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const layers = useGraphStore((s) => s.layers);
  const updateNode = useGraphStore((s) => s.updateNode);
  const addNode = useGraphStore((s) => s.addNode);
  const selectNode = useUIStore((s) => s.selectNode);
  const layerColors = useLayerColors(layers);
  const [sorting, setSorting] = useState<SortingState>([]);

  // Collect all dynamic property keys across all nodes
  const propertyKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const node of nodes) {
      for (const key of Object.keys(node.properties)) {
        keys.add(key);
      }
    }
    return [...keys].sort();
  }, [nodes]);

  // Count connections per node
  const connectionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const edge of edges) {
      counts.set(edge.fromNodeId, (counts.get(edge.fromNodeId) || 0) + 1);
      counts.set(edge.toNodeId, (counts.get(edge.toNodeId) || 0) + 1);
    }
    return counts;
  }, [edges]);

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "Name",
        cell: ({ row, getValue }) => (
          <EditableCell
            value={getValue()}
            onChange={(v) => updateNode(row.original.id, { name: v })}
            className="font-medium"
          />
        ),
      }),
      columnHelper.accessor("layerId", {
        header: "Layer",
        cell: ({ row, getValue }) => {
          const layerId = getValue();
          const color = layerColors.get(layerId) || "#999";
          return (
            <select
              value={layerId}
              onChange={(e) => updateNode(row.original.id, { layerId: e.target.value })}
              className="text-xs bg-transparent border-none p-0 focus:outline-none cursor-pointer"
              style={{ color }}
            >
              {layers.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          );
        },
      }),
      columnHelper.accessor("aliases", {
        header: "Aliases",
        cell: ({ row, getValue }) => (
          <EditableCell
            value={getValue().join(", ")}
            onChange={(v) =>
              updateNode(row.original.id, {
                aliases: v.split(",").map((s) => s.trim()).filter(Boolean),
              })
            }
          />
        ),
      }),
      columnHelper.display({
        id: "connections",
        header: "Conn",
        cell: ({ row }) => {
          const count = connectionCounts.get(row.original.id) || 0;
          return (
            <button
              onClick={() => selectNode(row.original.id)}
              className="text-xs text-accent hover:underline"
            >
              {count}
            </button>
          );
        },
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: ({ getValue }) => {
          const status = getValue();
          const icon = status === "confirmed" ? "✓" : status === "proposed" ? "◌" : "●";
          const color = status === "confirmed" ? "text-success" : status === "proposed" ? "text-accent" : "text-warning";
          return <span className={`text-xs ${color}`}>{icon}</span>;
        },
      }),
      // Dynamic property columns
      ...propertyKeys.map((key) =>
        columnHelper.display({
          id: `prop_${key}`,
          header: key,
          cell: ({ row }) => {
            const val = row.original.properties[key];
            return (
              <EditableCell
                value={val != null ? String(val) : ""}
                onChange={(v) =>
                  updateNode(row.original.id, {
                    properties: { ...row.original.properties, [key]: v },
                  })
                }
              />
            );
          },
        })
      ),
    ],
    [layers, layerColors, propertyKeys, connectionCounts, updateNode, selectNode]
  );

  const table = useReactTable({
    data: nodes,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const isolatedCount = nodes.filter(
    (n) => (connectionCounts.get(n.id) || 0) === 0
  ).length;

  const handleAddNode = () => {
    const firstLayer = layers[0];
    if (!firstLayer) return;
    const newNode: Node = {
      id: `n-${Date.now()}`,
      graphId: useGraphStore.getState().graphId || "",
      name: "New Node",
      aliases: [],
      layerId: firstLayer.id,
      properties: {},
      readme: null,
      childGraphId: null,
      sourceSegmentId: null,
      status: "confirmed",
      createdBy: "u-demo-user",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    addNode(newNode);
  };

  return (
    <div className="h-full overflow-auto bg-paper">
      <div className="p-3">
        <table className="w-full text-sm border-collapse">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-border">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="text-left text-xs font-semibold text-ink-muted uppercase tracking-wider px-2 py-2 cursor-pointer hover:bg-paper-darker select-none"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      <ArrowUpDown size={10} className="opacity-30" />
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const isIsolated = (connectionCounts.get(row.original.id) || 0) === 0;
              return (
                <tr
                  key={row.id}
                  className={`border-b border-border-light hover:bg-paper-darker/50 ${
                    isIsolated ? "bg-warning/5" : ""
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-2 py-1.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="flex items-center justify-between mt-3 text-xs text-ink-muted">
          <button
            onClick={handleAddNode}
            className="flex items-center gap-1 text-accent hover:text-accent-light"
          >
            <Plus size={14} /> Add node
          </button>
          <span>
            Showing {nodes.length} of {nodes.length}
            {isolatedCount > 0 && (
              <span className="text-warning"> · {isolatedCount} isolated</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

function EditableCell({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <input
        className={`text-xs bg-paper-dark border border-border rounded px-1 py-0.5 w-full focus:outline-none focus:ring-1 focus:ring-accent ${className}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          onChange(draft);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onChange(draft);
            setEditing(false);
          }
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        autoFocus
      />
    );
  }

  return (
    <span
      className={`text-xs cursor-text hover:bg-paper-darker/50 px-1 py-0.5 rounded block truncate ${className}`}
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
    >
      {value || <span className="text-ink-muted italic">—</span>}
    </span>
  );
}
