import { Routes, Route, Navigate } from 'react-router-dom';

import RootLayout from './layouts/RootLayout.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Challenges from './pages/Challenges.jsx';
import ChallengeDetail from './pages/ChallengeDetail.jsx';
import ReportProblem from './pages/ReportProblem.jsx';
import MyReports from './pages/MyReports.jsx';
import Universities from './pages/Universities.jsx';
import UniversityDetail from './pages/UniversityDetail.jsx';
import UniversityChallenges from './pages/UniversityChallenges.jsx';
import Industries from './pages/Industries.jsx';
import IndustryDetail from './pages/IndustryDetail.jsx';
import IndustryProjects from './pages/IndustryProjects.jsx';
import ProjectDetail from './pages/ProjectDetail.jsx';
import CreateProject from './pages/CreateProject.jsx';
import Projects from './pages/Projects.jsx';
import Samvaad from './pages/Samvaad.jsx';
import SamvaadDetail from './pages/SamvaadDetail.jsx';
import CreateDiscussion from './pages/CreateDiscussion.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import GovernmentHierarchy from './pages/GovernmentHierarchy.jsx';
import LocalProjects from './pages/LocalProjects.jsx';
import Solutions from './pages/Solutions.jsx';
import SolutionDetail from './pages/SolutionDetail.jsx';
import NotFound from './pages/NotFound.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<RootLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/challenges" element={<Challenges />} />
        <Route path="/challenges/:id" element={<ChallengeDetail />} />
        <Route path="/explore/map" element={<Navigate to="/challenges?view=map" replace />} />
        <Route path="/universities" element={<Universities />} />
        <Route path="/universities/:id" element={<UniversityDetail />} />
        <Route path="/industries" element={<Industries />} />
        <Route path="/industries/:id" element={<IndustryDetail />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/solutions" element={<Solutions />} />
        <Route path="/solutions/:id" element={<SolutionDetail />} />
        <Route element={<ProtectedRoute roles={['faculty', 'university', 'admin']} />}>
          <Route path="/projects/new" element={<CreateProject />} />
        </Route>
        <Route path="/samvaad" element={<Samvaad />} />
        <Route path="/samvaad/:id" element={<SamvaadDetail />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/samvaad/new" element={<CreateDiscussion />} />
        </Route>
        <Route path="/local-projects" element={<LocalProjects />} />
        <Route path="/projects/:id/track" element={<LocalProjects />} />
        <Route element={<ProtectedRoute roles={['university', 'admin']}/>}>
          <Route path="/university/challenges" element={<UniversityChallenges />} />
        </Route>
        <Route element={<ProtectedRoute roles={['government', 'admin']} />}>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/hierarchy" element={<GovernmentHierarchy />} />
          <Route path="/government/hierarchy" element={<GovernmentHierarchy />} />
        </Route>
        <Route element={<ProtectedRoute roles={['industry', 'admin']}/>}>
          <Route path="/industry/projects" element={<IndustryProjects />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/report" element={<ReportProblem />} />
          <Route path="/my-reports" element={<MyReports />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
