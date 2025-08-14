"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Mail, Lock, User, Building, Eye, EyeOff } from "lucide-react"
import { useRouter } from "next/navigation"

export function SignupForm() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    userType: "",
    organization: "",
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match")
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          userType: formData.userType,
          organization: formData.organization,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        // Store user data in localStorage (in a real app, use proper session management)
        localStorage.setItem("user", JSON.stringify(data.user))
        router.push("/dashboard")
      } else {
        setError(data.message || "Signup failed")
      }
    } catch (error) {
      setError("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="animate-fade-in">
      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        {error && (
          <Alert variant="destructive" className="animate-slide-up border-red-200 bg-red-50">
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {/* Name Field */}
        <div className="space-y-2 sm:space-y-3 animate-slide-up delay-100">
          <Label htmlFor="name" className="text-slate-700 font-medium text-sm sm:text-base">
            Full Name
          </Label>
          <div className="relative group">
            <User
              className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 transition-all duration-300 ${
                focusedField === "name" ? "text-emerald-600 scale-110" : "text-slate-400"
              }`}
            />
            <Input
              id="name"
              type="text"
              placeholder="Enter your full name"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              onFocus={() => setFocusedField("name")}
              onBlur={() => setFocusedField(null)}
              className={`pl-10 sm:pl-12 h-12 sm:h-14 transition-all duration-300 border-2 text-sm sm:text-base ${
                focusedField === "name"
                  ? "border-emerald-300 shadow-lg shadow-emerald-100 scale-[1.02]"
                  : "border-slate-200 hover:border-emerald-200"
              } focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100`}
              required
            />
          </div>
        </div>

        {/* Email Field */}
        <div className="space-y-2 sm:space-y-3 animate-slide-up delay-200">
          <Label htmlFor="email" className="text-slate-700 font-medium text-sm sm:text-base">
            Email
          </Label>
          <div className="relative group">
            <Mail
              className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 transition-all duration-300 ${
                focusedField === "email" ? "text-emerald-600 scale-110" : "text-slate-400"
              }`}
            />
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={(e) => handleInputChange("email", e.target.value)}
              onFocus={() => setFocusedField("email")}
              onBlur={() => setFocusedField(null)}
              className={`pl-10 sm:pl-12 h-12 sm:h-14 transition-all duration-300 border-2 text-sm sm:text-base ${
                focusedField === "email"
                  ? "border-emerald-300 shadow-lg shadow-emerald-100 scale-[1.02]"
                  : "border-slate-200 hover:border-emerald-200"
              } focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100`}
              required
            />
          </div>
        </div>

        {/* User Type Field */}
        <div className="space-y-2 sm:space-y-3 animate-slide-up delay-300">
          <Label htmlFor="userType" className="text-slate-700 font-medium text-sm sm:text-base">
            User Type
          </Label>
          <Select value={formData.userType} onValueChange={(value) => handleInputChange("userType", value)}>
            <SelectTrigger className="h-12 sm:h-14 border-2 border-slate-200 hover:border-emerald-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 transition-all duration-300 text-sm sm:text-base">
              <SelectValue placeholder="Select your role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="student">Student</SelectItem>
              <SelectItem value="staff">Staff Member</SelectItem>
              <SelectItem value="canteen">Canteen Manager</SelectItem>
              <SelectItem value="hostel">Hostel Manager</SelectItem>
              <SelectItem value="event">Event Organizer</SelectItem>
              <SelectItem value="ngo">NGO Representative</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Organization Field */}
        <div className="space-y-2 sm:space-y-3 animate-slide-up delay-400">
          <Label htmlFor="organization" className="text-slate-700 font-medium text-sm sm:text-base">
            Organization/Department
          </Label>
          <div className="relative group">
            <Building
              className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 transition-all duration-300 ${
                focusedField === "organization" ? "text-emerald-600 scale-110" : "text-slate-400"
              }`}
            />
            <Input
              id="organization"
              type="text"
              placeholder="Enter your organization or department"
              value={formData.organization}
              onChange={(e) => handleInputChange("organization", e.target.value)}
              onFocus={() => setFocusedField("organization")}
              onBlur={() => setFocusedField(null)}
              className={`pl-10 sm:pl-12 h-12 sm:h-14 transition-all duration-300 border-2 text-sm sm:text-base ${
                focusedField === "organization"
                  ? "border-emerald-300 shadow-lg shadow-emerald-100 scale-[1.02]"
                  : "border-slate-200 hover:border-emerald-200"
              } focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100`}
              required
            />
          </div>
        </div>

        {/* Password Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div className="space-y-2 sm:space-y-3 animate-slide-up delay-500">
            <Label htmlFor="password" className="text-slate-700 font-medium text-sm sm:text-base">
              Password
            </Label>
            <div className="relative group">
              <Lock
                className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 transition-all duration-300 ${
                  focusedField === "password" ? "text-emerald-600 scale-110" : "text-slate-400"
                }`}
              />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Create a password"
                value={formData.password}
                onChange={(e) => handleInputChange("password", e.target.value)}
                onFocus={() => setFocusedField("password")}
                onBlur={() => setFocusedField(null)}
                className={`pl-10 sm:pl-12 pr-10 sm:pr-12 h-12 sm:h-14 transition-all duration-300 border-2 text-sm sm:text-base ${
                  focusedField === "password"
                    ? "border-emerald-300 shadow-lg shadow-emerald-100 scale-[1.02]"
                    : "border-slate-200 hover:border-emerald-200"
                } focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100`}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-slate-400 hover:text-emerald-600 transition-all duration-300 hover:scale-110"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 sm:h-5 sm:w-5" />
                ) : (
                  <Eye className="h-4 w-4 sm:h-5 sm:w-5" />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-2 sm:space-y-3 animate-slide-up delay-600">
            <Label htmlFor="confirmPassword" className="text-slate-700 font-medium text-sm sm:text-base">
              Confirm Password
            </Label>
            <div className="relative group">
              <Lock
                className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 transition-all duration-300 ${
                  focusedField === "confirmPassword" ? "text-emerald-600 scale-110" : "text-slate-400"
                }`}
              />
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                onFocus={() => setFocusedField("confirmPassword")}
                onBlur={() => setFocusedField(null)}
                className={`pl-10 sm:pl-12 pr-10 sm:pr-12 h-12 sm:h-14 transition-all duration-300 border-2 text-sm sm:text-base ${
                  focusedField === "confirmPassword"
                    ? "border-emerald-300 shadow-lg shadow-emerald-100 scale-[1.02]"
                    : "border-slate-200 hover:border-emerald-200"
                } focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100`}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-slate-400 hover:text-emerald-600 transition-all duration-300 hover:scale-110"
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4 sm:h-5 sm:w-5" />
                ) : (
                  <Eye className="h-4 w-4 sm:h-5 sm:w-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full h-12 sm:h-14 gradient-primary text-white font-semibold hover-lift shadow-lg hover:shadow-emerald-200 transition-all duration-300 animate-slide-up delay-700 group text-sm sm:text-base"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
              <span className="animate-pulse">Creating account...</span>
            </>
          ) : (
            <>
              <span className="group-hover:scale-105 transition-transform duration-200">Create Account</span>
            </>
          )}
        </Button>
      </form>
    </div>
  )
}
