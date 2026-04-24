import React from 'react';
import './LogicCard.css';

const LogicCard = ({ title, children, selected, onClick }) => {
  return (
    <div 
      className={`logic-card ${selected ? 'selected' : ''}`} 
      onClick={onClick}
    >
      <h3 className="logic-card-title">{title}</h3>
      <div className="logic-card-content">
        {children}
      </div>
    </div>
  );
};

export default LogicCard;
