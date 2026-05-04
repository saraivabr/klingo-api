import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
import Metrics from './pages/Metrics';
import Settings from './pages/Settings';
import Subscriptions from './pages/Subscriptions';
import Finance from './pages/Finance';
import Teleconsultation from './pages/Teleconsultation';
import Schedules from './pages/Schedules';
import OPDVisits from './pages/OPDVisits';
import Billing from './pages/Billing';
import LabTests from './pages/LabTests';
import Pharmacy from './pages/Pharmacy';
import WorkflowDashboard from './pages/WorkflowDashboard';
import AppLayout from './components/layout/AppLayout';
import AccountsPayable from './pages/AccountsPayable';
import AccountsReceivable from './pages/AccountsReceivable';
import CashFlow from './pages/CashFlow';
import DailyPayments from './pages/DailyPayments';
import Reimbursements from './pages/Reimbursements';
import PaymentOrders from './pages/PaymentOrders';
import FinanceCadastros from './pages/FinanceCadastros';
import Users from './pages/Users';
import PDV from './pages/PDV';
import CRMPipeline from './pages/CRMPipeline';
import CRMMetrics from './pages/CRMMetrics';
import CRMCampaigns from './pages/CRMCampaigns';
import Hub from './pages/Hub';
import Plans from './pages/Plans';
import Indicators from './pages/Indicators';

function App() {
  const token = localStorage.getItem('token');

  if (!token) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
         <Route path="/" element={<WorkflowDashboard />} />
         <Route path="/conversations" element={<Dashboard />} />
         <Route path="/schedules" element={<Schedules />} />
         <Route path="/opd" element={<OPDVisits />} />
         <Route path="/billing" element={<Billing />} />
         <Route path="/lab" element={<LabTests />} />
         <Route path="/pharmacy" element={<Pharmacy />} />
         <Route path="/metrics" element={<Metrics />} />
         <Route path="/indicators" element={<Indicators />} />
         <Route path="/subscriptions" element={<Subscriptions />} />
         <Route path="/finance" element={<Finance />} />
         <Route path="/finance/payable" element={<AccountsPayable />} />
         <Route path="/finance/receivable" element={<AccountsReceivable />} />
         <Route path="/finance/daily" element={<DailyPayments />} />
         <Route path="/finance/cashflow" element={<CashFlow />} />
         <Route path="/finance/reimbursements" element={<Reimbursements />} />
         <Route path="/finance/orders" element={<PaymentOrders />} />
         <Route path="/finance/cadastros" element={<FinanceCadastros />} />
         <Route path="/crm/pipeline" element={<CRMPipeline />} />
         <Route path="/crm/metrics" element={<CRMMetrics />} />
         <Route path="/crm/campaigns" element={<CRMCampaigns />} />
         <Route path="/teleconsulta" element={<Teleconsultation />} />
         <Route path="/pdv" element={<PDV />} />
         <Route path="/users" element={<Users />} />
         <Route path="/hub" element={<Hub />} />
         <Route path="/plans" element={<Plans />} />
         <Route path="/settings" element={<Settings />} />
       </Route>
       <Route path="/conversations/:id" element={<Chat />} />
       <Route path="/login" element={<Login />} />
     </Routes>
   );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename="/painel">
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
