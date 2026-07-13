import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const FormPilot = () => {
  const { id } = useParams();
  const { isAccg } = useAuth();

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link
              to={isAccg ? '/accg' : `/county/${id}`}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-2 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back
            </Link>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            FormPilot
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            AI-Powered Government Compliance Form Assistant
          </p>
        </div>

        {/* Coming Soon Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <div className="max-w-2xl mx-auto">
            {/* Icon */}
            <div className="mb-6 flex justify-center">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>

            {/* Badge */}
            <div className="mb-6 inline-block">
              <span className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm font-semibold">
                Coming Soon
              </span>
            </div>

            {/* Title */}
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              FormPilot is Under Development
            </h2>

            {/* Description */}
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
              FormPilot is an AI-powered assistant designed to help you fill out government compliance forms quickly and accurately. Our intelligent system will guide you through complex forms, ensure all required fields are completed correctly, and help you maintain compliance with ease.
            </p>

            {/* Features Preview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6 border border-gray-200 dark:border-gray-600">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">AI-Powered Guidance</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Get intelligent assistance as you fill out forms
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6 border border-gray-200 dark:border-gray-600">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Compliance Check</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Ensure all requirements are met before submission
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6 border border-gray-200 dark:border-gray-600">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Quick & Efficient</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Save time with automated form completion
                </p>
              </div>
            </div>

            {/* Notification */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-left">
                  <p className="text-blue-900 dark:text-blue-200 font-medium mb-1">
                    Stay Updated
                  </p>
                  <p className="text-blue-800 dark:text-blue-300 text-sm">
                    We're working hard to bring you this powerful tool. FormPilot will be available soon to help streamline your compliance form processes.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormPilot;

