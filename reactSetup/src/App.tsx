import React from 'react'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import TestAIAssistant from '../../admin-portal/components/TestAIAssistant'

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        {/* Navigation Bar */}
        <nav className="bg-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex space-x-8">
                <Link 
                  to="/" 
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900 border-b-2 border-transparent hover:border-blue-500"
                >
                  🏠 Home
                </Link>
                <Link 
                  to="/test/ai" 
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900 border-b-2 border-transparent hover:border-blue-500"
                >
                  🧪 Test AI Assistant
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {/* Routes */}
        <Routes>
          <Route path="/" element={
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
              <div className="text-center">
                <h1 className="text-4xl font-bold text-gray-900 mb-4">
                  Welcome to PureTask Backend
                </h1>
                <p className="text-lg text-gray-600 mb-8">
                  Navigate to the AI Test page to try out the features!
                </p>
                <Link 
                  to="/test/ai"
                  className="inline-block px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
                >
                  🧪 Go to AI Test Page
                </Link>
              </div>
            </div>
          } />
          
          <Route path="/test/ai" element={<TestAIAssistant />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
