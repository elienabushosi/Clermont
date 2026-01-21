"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ArrowLeft } from "lucide-react";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const loginSchema = z.object({
	email: z.string().email("Please enter a valid email address"),
	password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
	const router = useRouter();
	const [isLoading, setIsLoading] = useState(false);
	const [isSuccess, setIsSuccess] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const form = useForm<LoginFormValues>({
		resolver: zodResolver(loginSchema),
		defaultValues: {
			email: "",
			password: "",
		},
	});

	const onSubmit = async (data: LoginFormValues) => {
		setError(null);
		setIsLoading(true);

		try {
			const response = await fetch(
				"http://localhost:3002/api/auth/login",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(data),
				}
			);

			const result = await response.json();

			if (!response.ok) {
				setError(result.message || "Invalid email or password");
				setIsLoading(false);
				return;
			}

			// Success - store the token if provided
			if (result.token) {
				localStorage.setItem("auth_token", result.token);
			}

			// Wait 1 second, then turn button green
			setTimeout(() => {
				setIsSuccess(true);
				// Navigate to home page after showing success
				setTimeout(() => {
					router.push("/home");
				}, 500);
			}, 1000);
		} catch (error) {
			console.error("Login error:", error);
			setError("An error occurred. Please try again.");
			setIsLoading(false);
		}
	};

	return (
		<div className="w-full min-h-screen bg-[#F7F5F3] flex items-center justify-center p-4">
			<div className="w-full max-w-md">
				<button
					onClick={() => router.push("/")}
					className="mb-4 flex items-center gap-2 text-[#37322F] hover:text-[#4090C2] transition-colors text-sm font-medium"
				>
					<ArrowLeft className="w-4 h-4" />
					Back
				</button>
				<div className="bg-white rounded-lg shadow-sm border border-[rgba(55,50,47,0.12)] p-8">
					<h1 className="text-2xl font-semibold text-[#37322F] mb-6">
						Log in to Lindero
					</h1>
					<Form {...form}>
						<form
							onSubmit={form.handleSubmit(onSubmit)}
							className="space-y-6"
						>
							<FormField
								control={form.control}
								name="email"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="text-[#37322F]">
											Email
										</FormLabel>
										<FormControl>
											<Input
												type="email"
												placeholder="Enter your email"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="password"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="text-[#37322F]">
											Password
										</FormLabel>
										<FormControl>
											<Input
												type="password"
												placeholder="Enter your password"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							{error && (
								<div className="text-sm text-red-600">
									{error}
								</div>
							)}
							<Button
								type="submit"
								disabled={isLoading || isSuccess}
								className={`w-full text-white ${
									isSuccess
										? "bg-green-600 hover:bg-green-700"
										: "bg-[#37322F] hover:bg-[#37322F]/90"
								}`}
							>
								{isLoading
									? "Logging in..."
									: isSuccess
									? "Access granted"
									: "Log in"}
							</Button>
						</form>
						<div className="mt-6 text-center">
							<Link
								href="/signup"
								className="text-sm text-[#37322F] hover:text-[#4090C2] transition-colors underline"
							>
								Create an account
							</Link>
						</div>
					</Form>
				</div>
			</div>
		</div>
	);
}
