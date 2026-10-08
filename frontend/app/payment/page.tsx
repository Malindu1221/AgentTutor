'use client';
import Link from 'next/link';

export default function PaymentPage() {
    const plans = [
        { name: "Basic", price: "Free", features: ["3 AI Roadmaps per 5 hours", "Standard Search", "Community Support"], color: "from-gray-700 to-gray-900" },
        { name: "Pro", price: "$9/mo", features: ["Unlimited AI Roadmaps", "AI-powered Deep Search", "Priority Queue"], color: "from-blue-600 to-purple-700" },
        { name: "Premium", price: "$19/mo", features: ["All Pro features", "1-on-1 Mentorship", "PDF Roadmap Downloads"], color: "from-yellow-500 to-red-600" },
    ];
    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center py-16 px-6">
            <h1 className="text-4xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">Upgrade Your Learning Journey</h1>
            <p className="text-gray-400 mb-12 text-center max-w-xl">You have reached your free limit. Upgrade to unlock unlimited AI roadmap generations.</p>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl w-full">
                {plans.map((plan, idx) => (
                    <div key={idx} className={`rounded-2xl p-8 shadow-lg bg-gradient-to-br ${plan.color} hover:scale-105 transform transition duration-300 flex flex-col justify-between`}>
                        <div>
                            <h2 className="text-2xl font-semibold mb-2">{plan.name}</h2>
                            <p className="text-4xl font-bold mb-6">{plan.price}</p>
                            <ul className="space-y-2 mb-8">
                                {plan.features.map((feat, i) => (
                                    <li key={i} className="flex items-center text-gray-200"><span className="ml-2">✓ {feat}</span></li>
                                ))}
                            </ul>
                        </div>
                        <Link className="block text-center py-3 px-6 rounded-lg bg-black/60 hover:bg-black/80 transition" href="/checkout">Choose Plan</Link>
                    </div>
                ))}
            </div>
            <Link className="mt-12 text-gray-400 hover:text-gray-200" href="/">← Back to Home</Link>
        </div>
    );
}

