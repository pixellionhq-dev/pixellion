import React from 'react';

export default function LiveFeed({ activity = [] }) {
    if (!activity || activity.length === 0) return null;

    return (
        <div className="fixed bottom-6 left-6 z-50 bg-white/90 backdrop-blur-md border border-gray-200 shadow-xl rounded-xl p-4 w-72">
            {activity.map((item, index) => (
                <div key={item.id || index} className="text-sm text-gray-700 mb-2">
                    {item.text}
                </div>
            ))}
        </div>
    );
}
