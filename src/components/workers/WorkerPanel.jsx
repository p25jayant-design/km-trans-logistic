import React from 'react';
import { Users } from 'lucide-react';
import Card from '../ui/Card.jsx';
import WorkerCard from './WorkerCard.jsx';

export default function WorkerPanel({ result, frame }) {
  const departments = frame?.departments || [];
  return (
    <Card title="Departmental Workforce" icon={Users}>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {departments.map((dept) => (
          <WorkerCard
            key={dept.key}
            dept={dept}
            roster={result?.cfg?.departments?.[dept.key]}
            isBottleneck={frame?.bottleneck?.kind === 'dept' && frame.bottleneck.key === dept.key}
          />
        ))}
        {departments.length === 0 && (
          <p className="col-span-2 text-[12.5px] text-ink-faint">Run the simulation to see live workforce status.</p>
        )}
      </div>
    </Card>
  );
}
