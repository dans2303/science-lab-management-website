// src/App.tsx
import React from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";

import LabIPALanding from "./LabIPALanding";
import LabIPABooking from "./LabIPABooking";
import LabIPASOP from "./LabIPASOP";
import LabIPADashboard from "./LabIPADashboard"; 
import LabIPAAdmin from "./LabIPAAdmin";         

const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<LabIPALanding />} />
        <Route path="/booking" element={<LabIPABooking />} />
        <Route path="/sop" element={<LabIPASOP />} />
        <Route path="/dashboard" element={<LabIPADashboard />} />
        <Route path="/admin" element={<LabIPAAdmin />} />
        {/* default redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
