"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button } from "./ui/button";
import axiosInstance from "@/lib/axiosinstance";
import { useUser } from "@/lib/AuthContext";

type PlanName = "FREE" | "BRONZE" | "SILVER" | "GOLD";

interface Plan {
    name: PlanName;
    price: number;
    maxMinutes: number | null;
}

const PLAN_ORDER: PlanName[] = ["FREE", "BRONZE", "SILVER", "GOLD"];

const planStyles: Record<PlanName, string> = {
    FREE: "border-gray-300",
    BRONZE: "border-amber-500",
    SILVER: "border-slate-500",
    GOLD: "border-yellow-500",
};

const SubscriptionPlans = () => {
    const { user, login } = useUser();

    const [plans, setPlans] = useState<Plan[]>([]);
    const [currentPlan, setCurrentPlan] = useState<PlanName>("FREE");
    const [loading, setLoading] = useState(true);
    const [updatingPlan, setUpdatingPlan] = useState<PlanName | null>(null);
    const [message, setMessage] = useState("");

    const sortedPlans = useMemo(() => {
        return [...plans].sort(
            (a, b) => PLAN_ORDER.indexOf(a.name) - PLAN_ORDER.indexOf(b.name)
        );
    }, [plans]);

    const fetchData = async () => {
        setLoading(true);
        setMessage("");

        try {
            // 1) all plans
            const plansRes = await axiosInstance.get("/subscription/plans");
            setPlans(plansRes.data || []);

            // 2) logged-in user's current plan
            if (user?._id) {
                const subRes = await axiosInstance.get(`/subscription/user/${user._id}`);
                setCurrentPlan((subRes.data?.plan || "FREE") as PlanName);
            } else {
                setCurrentPlan("FREE");
            }
        } catch (error) {
            console.log("Subscription fetch error:", error);
            setMessage("Failed to load subscription data.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [user?._id]);

    const handlePlanChange = async (plan: PlanName) => {
        if (!user?._id) {
            setMessage("Please sign in first to change your subscription.");
            return;
        }

        if (plan === currentPlan) {
            setMessage("You are already on this plan.");
            return;
        }

        setUpdatingPlan(plan);
        setMessage("");

        try {
            const res = await axiosInstance.patch("/subscription/change", {
                userId: user._id,
                plan,
            });

            setCurrentPlan(plan);
            setMessage(`Subscription updated to ${plan} successfully.`);

            // keep AuthContext user fresh with latest subscriptionPlan
            if (res.data?.user) {
                login(res.data.user);
            } else if (user) {
                login({ ...user, subscriptionPlan: plan });
            }
        } catch (error) {
            console.log("Plan update error:", error);
            setMessage("Failed to update subscription. Please try again.");
        } finally {
            setUpdatingPlan(null);
        }
    };

    if (loading) {
        return <div className="p-6">Loading subscription plans...</div>;
    }

    return (
        <div className="w-full p-6">
        <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Subscription Plans</h1>
    <p className="text-sm text-gray-600 mb-6">
        Current Plan: <span className="font-semibold">{currentPlan}</span>
        </p>

    {message && (
        <div className="mb-4 rounded-md bg-gray-100 border p-3 text-sm">
            {message}
            </div>
    )}

    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {sortedPlans.map((plan) => {
                const isCurrent = plan.name === currentPlan;
                const isUnlimited = plan.maxMinutes === null;

                return (
                    <div
                        key={plan.name}
                className={`rounded-xl border-2 p-4 shadow-sm ${planStyles[plan.name]} ${
                    isCurrent ? "bg-gray-50" : "bg-white"
                }`}
            >
                <h2 className="text-lg font-semibold">{plan.name}</h2>
                    <p className="text-2xl font-bold mt-2">₹{plan.price}</p>
                <p className="text-sm text-gray-600 mt-1">
                {isUnlimited
                    ? "Unlimited watch time"
                    : `Watch up to ${plan.maxMinutes} minutes per video`}
                </p>

                <div className="mt-4">
                    {isCurrent ? (
                            <Button className="w-full" variant="secondary" disabled>
                    Current Plan
                </Button>
            ) : (
                    <Button
                        className="w-full"
                onClick={() => handlePlanChange(plan.name)}
                disabled={updatingPlan !== null}
            >
                {updatingPlan === plan.name ? "Updating..." : "Choose Plan"}
                </Button>
            )}
                </div>
                </div>
            );
            })}
        </div>

    {!user && (
        <p className="text-sm text-red-600 mt-4">
            You are not signed in. Sign in to upgrade your plan.
    </p>
    )}
    </div>
    </div>
);
};

export default SubscriptionPlans;