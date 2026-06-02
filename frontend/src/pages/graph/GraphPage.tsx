import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  Position,
} from 'reactflow';
import type { Node, Edge } from 'reactflow';
import 'reactflow/dist/style.css';
import Layout from '../../components/layout/Layout';
import api from '../../services/api';

const hypStatusColors: Record<string, string> = {
  VALIDATED: '#10b981',
  INVALIDATED: '#ef4444',
  IN_PROGRESS: '#f59e0b',
  OPEN: '#3b82f6',
};

export default function GraphPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchGraphData();
  }, []);

  const fetchGraphData = async () => {
    try {
      const { data: projects } = await api.get('/projects/graph');
      const allNodes: Node[] = [];
      const allEdges: Edge[] = [];

      let xOffset = 0;

      (projects || []).forEach((project: any, projectIndex: number) => {
        const projectX = xOffset;
        const projectY = 0;

        allNodes.push({
          id: `project-${project.id}`,
          type: 'input',
          position: { x: projectX, y: projectY },
          data: { label: project.nom },
          style: {
            background: '#1e293b',
            color: 'white',
            border: '2px solid #3b82f6',
            borderRadius: '8px',
            padding: '12px 16px',
            fontWeight: 600,
            fontSize: '14px',
          },
          sourcePosition: Position.Right,
        });

        let objY = projectY + 150;

        (project.objectives || []).forEach((obj: any, objIdx: number) => {
          const objX = projectX + 300;

          allNodes.push({
            id: `obj-${obj.id}`,
            position: { x: objX, y: objY + objIdx * 150 },
            data: { label: obj.content.substring(0, 40) + '...', projectId: project.id },
            style: {
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '12px',
            },
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
          });

          allEdges.push({
            id: `e-proj-obj-${obj.id}`,
            source: `project-${project.id}`,
            target: `obj-${obj.id}`,
            markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' },
          });

          let axeY = objY + objIdx * 150 + 60;

          (obj.axes || []).forEach((axe: any, axeIdx: number) => {
            const axeX = objX + 300;

            allNodes.push({
              id: `axe-${axe.id}`,
              position: { x: axeX, y: axeY + axeIdx * 120 },
              data: { label: axe.name, projectId: project.id },
              style: {
                background: '#8b5cf6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '12px',
              },
              sourcePosition: Position.Right,
              targetPosition: Position.Left,
            });

            allEdges.push({
              id: `e-obj-axe-${axe.id}`,
              source: `obj-${obj.id}`,
              target: `axe-${axe.id}`,
              markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' },
            });

            let hypY = axeY + axeIdx * 120 + 50;

            (axe.hypotheses || []).forEach((hyp: any, hypIdx: number) => {
              const hypX = axeX + 300;
              const color = hypStatusColors[hyp.statut] || '#6b7280';

              allNodes.push({
                id: `hyp-${hyp.id}`,
                position: { x: hypX, y: hypY + hypIdx * 100 },
                data: { label: hyp.content.substring(0, 35) + '...', projectId: project.id },
                style: {
                  background: color,
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  fontSize: '11px',
                },
                sourcePosition: Position.Right,
                targetPosition: Position.Left,
              });

              allEdges.push({
                id: `e-axe-hyp-${hyp.id}`,
                source: `axe-${axe.id}`,
                target: `hyp-${hyp.id}`,
                markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' },
              });

              hypY += 100;
            });

            axeY += 120;
          });

          objY += 150;
        });

        xOffset += 500;

        // Perimeters for this project
        let perimY = 0;

        (project.perimeters || []).forEach((perim: any, idx: number) => {
          const perimX = xOffset + 100;

          allNodes.push({
            id: `perim-${perim.id}`,
            position: { x: perimX, y: perimY + idx * 100 + 150 },
            data: { label: `${perim.name} (${perim.type === 'GEOGRAPHIC' ? 'Géo' : 'Sectoriel'})`, projectId: project.id },
            style: {
              background: perim.type === 'GEOGRAPHIC' ? '#f59e0b' : '#ec4899',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '12px',
            },
            sourcePosition: Position.Left,
            targetPosition: Position.Right,
          });

          perimY += 100;
        });

        xOffset += 200;
      });

      setNodes(allNodes);
      setEdges(allEdges);
    } catch (err) {
      console.error('Failed to fetch graph data:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-white">Arborescence des projets</h1>
          <p className="text-sm mt-1" style={{ color: '#6b7280' }}>
            Visualisation : Projet → Objectif → Axe → Hypothèse
          </p>
        </div>

        {loading ? (
          <div
            className="h-[calc(100vh-250px)] rounded-xl flex items-center justify-center"
            style={{ background: '#161b27', border: '1px solid #1e2535' }}
          >
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
          </div>
        ) : (
          <div
            className="h-[calc(100vh-250px)] rounded-xl"
            style={{ background: '#161b27', border: '1px solid #1e2535' }}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              fitView
              attributionPosition="bottom-right"
              onNodeClick={(_, node) => {
                const [type, id] = node.id.split('-');
                if (type === 'project') navigate(`/projects/${id}`);
                else if (type === 'obj' || type === 'axe' || type === 'hyp')
                  navigate(`/projects/${node.data.projectId}`);
              }}
            >
              <Background color="#334155" gap={20} />
              <Controls />
            </ReactFlow>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-6 text-sm flex-wrap mt-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full" style={{ background: '#1e293b', border: '2px solid #3b82f6' }} />
            <span style={{ color: '#9ca3af' }}>Projet</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-blue-500" />
            <span style={{ color: '#9ca3af' }}>Objectif</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-purple-500" />
            <span style={{ color: '#9ca3af' }}>Axe</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-emerald-500" />
            <span style={{ color: '#9ca3af' }}>Hyp. validée</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-amber-500" />
            <span style={{ color: '#9ca3af' }}>En cours</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-red-500" />
            <span style={{ color: '#9ca3af' }}>Invalidée</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-amber-500" />
            <span style={{ color: '#9ca3af' }}>Périmètre géo.</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-pink-500" />
            <span style={{ color: '#9ca3af' }}>Périmètre sectoriel</span>
          </div>
        </div>
      </div>
    </Layout>
  );
}
