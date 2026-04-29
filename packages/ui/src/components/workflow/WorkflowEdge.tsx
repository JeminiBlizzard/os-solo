export interface WorkflowEdgeData {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

interface WorkflowEdgeProps {
  edge: WorkflowEdgeData;
  sourcePos: { x: number; y: number };
  targetPos: { x: number; y: number };
}

export function WorkflowEdge({ edge, sourcePos, targetPos }: WorkflowEdgeProps) {
  // Calculate control point for quadratic bezier curve
  // Place it midway between source and target, offset vertically
  const midX = (sourcePos.x + targetPos.x) / 2;
  const midY = (sourcePos.y + targetPos.y) / 2;
  const offsetY = Math.abs(targetPos.x - sourcePos.x) * 0.3;

  const path = `M ${sourcePos.x} ${sourcePos.y} Q ${midX} ${midY - offsetY} ${targetPos.x} ${targetPos.y}`;

  return (
    <g>
      <path
        d={path}
        stroke="#3b82f6"
        strokeWidth="2"
        strokeDasharray="5,5"
        fill="none"
        className="pointer-events-none"
      />
      {/* Arrowhead */}
      <circle
        cx={targetPos.x}
        cy={targetPos.y}
        r="4"
        fill="#3b82f6"
        className="pointer-events-none"
      />
    </g>
  );
}
