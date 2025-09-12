function ModalWindow({ children, onClose }) {
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };
  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-centered">
        {children}
      </div>
    </div>
  );
}

export default ModalWindow;