import React from 'react';
import { ENTITY_TYPE_LABELS, ENTITY_TYPE_BADGE_CLASSES } from '../mockData';

const TypeBadge = ({ type, className = '' }) => (
  <span
    className={`inline-flex items-center text-[10.5px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${ENTITY_TYPE_BADGE_CLASSES[type]} ${className}`}
  >
    {ENTITY_TYPE_LABELS[type]}
  </span>
);

export default TypeBadge;
