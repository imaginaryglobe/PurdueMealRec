function SidePopout({ children, onClose }) {
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };
  return (
    <div className="sidepop-overlay" onClick={handleOverlayClick}>
      <div className="sidepop-panel">
        {children}
      </div>
    </div>
  );
}

export default SidePopout;