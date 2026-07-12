import React, { useState } from 'react';

// Static chat panel — UI only. Sending does nothing; real wiring comes later.
const MOCK_MESSAGES = [
  { id: 1, text: 'Hello! I can help you look up filings, entities, and submissions. What do you need?', sender: 'bot' },
  { id: 2, text: 'How many authorities still owe AARF this cycle?', sender: 'user' },
  { id: 3, text: 'This is a UI preview — chatbot answers aren’t wired up yet.', sender: 'bot' }
];

const ChatPanel = ({ onClose }) => {
  const [inputMessage, setInputMessage] = useState('');

  return (
    <div className="fixed bottom-24 right-6 z-50 w-96 h-[600px] bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300">
      <div className="bg-blue-600 dark:bg-blue-700 text-white p-4 rounded-t-lg flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-lg">DCA Assistant</h3>
            <p className="text-xs text-blue-100">We're here to help</p>
          </div>
        </div>
        <button onClick={onClose} className="text-white hover:text-gray-200 transition-colors" aria-label="Close chatbot">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900">
        {MOCK_MESSAGES.map((message) => (
          <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.sender === 'user'
                  ? 'bg-blue-600 dark:bg-blue-700 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.text}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
        <form onSubmit={(e) => e.preventDefault()} className="flex gap-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center"
            aria-label="Send message"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatPanel;
