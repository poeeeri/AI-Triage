import React from 'react';
import { cls } from '../../utils/constants.js';

export function PriorityBadge({ item }) {
  return (
    <span className={cls("inline-flex items-center gap-2 border text-xs px-2.5 py-1 rounded-full", item.priorityColor)}>
      <span className={cls("h-2 w-2 rounded-full", item.priorityDot)} />
      {item.priorityKey}
    </span>
  );
}