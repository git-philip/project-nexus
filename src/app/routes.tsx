import { createBrowserRouter, Outlet, useLocation } from 'react-router'; 
import { LoginPage } from './pages/LoginPage';
import { PCSimulator3D } from './pages/PCSimulator3D';
import { StudentDashboard } from './pages/StudentDashboard';
import { ARScanner } from './pages/ARScanner';
import { AIChatbot } from './pages/AIChatbot';
import { InstructorDashboard } from './pages/InstructorDashboard';
import { AppLayout } from './components/AppLayout';
import { NetworkSimulator } from './pages/NetworkSimulator';
import { AdminPage } from './pages/AdminPage';
import { AIAssistant } from './components/AIAssistant';
import { StudentClassroom } from './pages/StudentClassroom';

// 1. CREATE A GLOBAL WRAPPER
// This renders the AI Assistant on top, and the current page inside the <Outlet />
const RootWrapper = () => {
  const location = useLocation();
  
  // Define paths where the AI Assistant should be hidden
  const hideAssistantPaths = ['/'];
  const shouldShowAssistant = !hideAssistantPaths.includes(location.pathname);

  return (
    <>
      {/* Only render the AI Assistant if we are NOT on the login page */}
      {shouldShowAssistant && <AIAssistant />}
      <Outlet /> 
    </>
  );
};

// 2. DEFINE YOUR ROUTES
export const router = createBrowserRouter([
  {
    // Wrap ALL routes inside the RootWrapper
    element: <RootWrapper />,
    children: [
      {
        path: '/',
        element: <LoginPage />,
      },
      
      // --- CADET (STUDENT) ROUTES ---
      {
        path: '/dashboard',
        element: (
          <AppLayout userType="student">
            <StudentDashboard />
          </AppLayout>
        ),
      },
      {
        path: '/network-sim',
        element: (
          <AppLayout userType="student">
            <NetworkSimulator />
          </AppLayout>
        ),
      },
      {
        path: '/pc-simulator',
        element: (
          <AppLayout userType="student">
            <PCSimulator3D />
          </AppLayout>
        ),
      },
      {
        path: '/ar-scanner',
        element: (
          <AppLayout userType="student">
            <ARScanner />
          </AppLayout>
        ),
      },
      {
        path: '/ai-chatbot',
        element: (
          <AppLayout userType="student">
            <AIChatbot />
          </AppLayout>
        ),
      },
      // --- ADDED THE STUDENT CLASSROOM ROUTE HERE ---
      {
        path: '/StudentClassroom',
        element: (
          <AppLayout userType="student">
            <StudentClassroom />
          </AppLayout>
        ),
      },

      // --- INSTRUCTOR ROUTES ---
      {
        path: '/instructor',
        element: (
          <AppLayout userType="instructor">
            <InstructorDashboard />
          </AppLayout>
        ),
      },
      {
        path: '/instructor/network-sim',
        element: (
          <AppLayout userType="instructor">
            <NetworkSimulator />
          </AppLayout>
        ),
      },
      {
        path: '/instructor/pc-simulator',
        element: (
          <AppLayout userType="instructor">
            <PCSimulator3D />
          </AppLayout>
        ),
      },
      {
        path: '/instructor/ar-scanner',
        element: (
          <AppLayout userType="instructor">
            <ARScanner />
          </AppLayout>
        ),
      },
      {
        path: '/instructor/ai-chatbot',
        element: (
          <AppLayout userType="instructor">
            <AIChatbot />
          </AppLayout>
        ),
      },

      // --- ADMIN ROUTE ---
      {
        path: '/admin',
        element: <AdminPage />, // No AppLayout wrapper!
      },
    ]
  }
]);