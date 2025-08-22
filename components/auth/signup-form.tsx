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
  collegeName: "",
  canteenName: "",
  hostelName: "",
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [info, setInfo] = useState("")
  const [otpStep, setOtpStep] = useState(false)
  const [otp, setOtp] = useState("")
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    const validateEmail = (email: string) => {
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      return re.test(String(email).trim().toLowerCase())
    }

    if (!validateEmail(formData.email)) {
      setError("Please enter a valid email address")
      setIsLoading(false)
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match")
      setIsLoading(false)
      return
    }

    if (!formData.userType) {
      setError("Please select your role")
      setIsLoading(false)
      return
    }

    // Role-specific required fields
    if (formData.userType === 'student' && !formData.collegeName.trim()) {
      setError("Please enter your college name")
      setIsLoading(false)
      return
    }
    if (formData.userType === 'canteen' && !formData.canteenName.trim()) {
      setError("Please enter your canteen name")
      setIsLoading(false)
      return
    }
    if (formData.userType === 'hostel' && !formData.hostelName.trim()) {
      setError("Please enter your hostel name")
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
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          userType: formData.userType,
          organization: formData.organization,
          collegeName: formData.collegeName || undefined,
          canteenName: formData.canteenName || undefined,
          hostelName: formData.hostelName || undefined,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        if (data.requiresVerification) {
          setOtpStep(true)
          setInfo("We sent a 6-digit code to your email. Enter it below to verify.")
        } else {
          localStorage.setItem("user", JSON.stringify(data.user))
          router.push("/dashboard")
        }
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

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setInfo("")
    if (!otp || otp.length < 6) {
      setError("Enter the 6-digit code")
      return
    }
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email.trim().toLowerCase(), code: otp })
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message || "Verification failed")
        return
      }
      setInfo("Verified! Redirecting…")
      // Auto-login after verification
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email.trim().toLowerCase(), password: formData.password })
      })
      const loginData = await loginRes.json()
      if (loginRes.ok) {
        localStorage.setItem("user", JSON.stringify(loginData.user))
        router.push("/dashboard")
      } else {
        setError(loginData.message || "Login failed after verification")
      }
    } catch (e) {
      setError("Verification failed. Try again.")
    }
  }

  const handleResend = async () => {
    setError("")
    setInfo("")
    try {
      const res = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email.trim().toLowerCase() })
      })
      const data = await res.json()
      if (res.ok) setInfo("Code sent. Check your inbox.")
      else setError(data.message || "Could not send code")
    } catch {
      setError("Could not send code")
    }
  }

  return (
    <div className="animate-fade-in">
      {!otpStep ? (
      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        {error && (
          <Alert variant="destructive" className="animate-slide-up border-red-200 bg-red-50">
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}
        {info && !error && (
          <Alert className="animate-slide-up border-emerald-200 bg-emerald-50">
            <AlertDescription className="text-emerald-800">{info}</AlertDescription>
          </Alert>
        )}

        {/* Role/User Type Field - always first */}
        <div className="space-y-2 sm:space-y-3 animate-slide-up">
          <Label htmlFor="userType" className="text-slate-700 font-medium text-sm sm:text-base">
            Select your role
          </Label>
          <Select value={formData.userType} onValueChange={(value) => handleInputChange("userType", value)}>
            <SelectTrigger className="h-12 sm:h-14 border-2 border-slate-200 hover:border-emerald-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 transition-all duration-300 text-sm sm:text-base">
              <SelectValue placeholder="Choose role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="student">Student</SelectItem>
              <SelectItem value="ngo">NGO</SelectItem>
              <SelectItem value="canteen">Canteen Member</SelectItem>
              <SelectItem value="hostel">Hostel Manager</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Name Field */}
        <div className="space-y-2 sm:space-y-3 animate-slide-up delay-100">
          <Label htmlFor="name" className="text-slate-700 font-medium text-sm sm:text-base">
            {formData.userType === 'canteen' || formData.userType === 'hostel' ? 'Contact Name' : 'Full Name'}
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
              placeholder={formData.userType === 'canteen' || formData.userType === 'hostel' ? 'Enter contact/manager name' : 'Enter your full name'}
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

        {/* Role-specific organization fields */}
        {formData.userType === 'student' && (
          <div className="space-y-2 sm:space-y-3 animate-slide-up delay-200">
            <Label htmlFor="collegeName" className="text-slate-700 font-medium text-sm sm:text-base">
              College Name
            </Label>
            <div className="relative group">
              <Building
                className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 transition-all duration-300 ${
                  focusedField === "collegeName" ? "text-emerald-600 scale-110" : "text-slate-400"
                }`}
              />
              <Input
                id="collegeName"
                type="text"
                placeholder="Enter your college name"
                value={formData.collegeName}
                onChange={(e) => handleInputChange("collegeName", e.target.value)}
                onFocus={() => setFocusedField("collegeName")}
                onBlur={() => setFocusedField(null)}
                className={`pl-10 sm:pl-12 h-12 sm:h-14 transition-all duration-300 border-2 text-sm sm:text-base ${
                  focusedField === "collegeName"
                    ? "border-emerald-300 shadow-lg shadow-emerald-100 scale-[1.02]"
                    : "border-slate-200 hover:border-emerald-200"
                } focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100`}
                required
              />
            </div>
          </div>
        )}

        {formData.userType === 'canteen' && (
          <div className="space-y-2 sm:space-y-3 animate-slide-up delay-200">
            <Label htmlFor="canteenName" className="text-slate-700 font-medium text-sm sm:text-base">
              Canteen Name
            </Label>
            <div className="relative group">
              <Building
                className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 transition-all duration-300 ${
                  focusedField === "canteenName" ? "text-emerald-600 scale-110" : "text-slate-400"
                }`}
              />
              <Input
                id="canteenName"
                type="text"
                placeholder="Enter canteen name"
                value={formData.canteenName}
                onChange={(e) => handleInputChange("canteenName", e.target.value)}
                onFocus={() => setFocusedField("canteenName")}
                onBlur={() => setFocusedField(null)}
                className={`pl-10 sm:pl-12 h-12 sm:h-14 transition-all duration-300 border-2 text-sm sm:text-base ${
                  focusedField === "canteenName"
                    ? "border-emerald-300 shadow-lg shadow-emerald-100 scale-[1.02]"
                    : "border-slate-200 hover:border-emerald-200"
                } focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100`}
                required
              />
            </div>
            <div className="space-y-2 sm:space-y-3">
              <Label htmlFor="organization" className="text-slate-700 font-medium text-sm sm:text-base">
                Organization (optional)
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
                  placeholder="Enter organization name (if any)"
                  value={formData.organization}
                  onChange={(e) => handleInputChange("organization", e.target.value)}
                  onFocus={() => setFocusedField("organization")}
                  onBlur={() => setFocusedField(null)}
                  className={`pl-10 sm:pl-12 h-12 sm:h-14 transition-all duration-300 border-2 text-sm sm:text-base ${
                    focusedField === "organization"
                      ? "border-emerald-300 shadow-lg shadow-emerald-100 scale-[1.02]"
                      : "border-slate-200 hover:border-emerald-200"
                  } focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100`}
                />
              </div>
            </div>
          </div>
        )}

        {formData.userType === 'hostel' && (
          <div className="space-y-2 sm:space-y-3 animate-slide-up delay-200">
            <Label htmlFor="hostelName" className="text-slate-700 font-medium text-sm sm:text-base">
              Hostel Name
            </Label>
            <div className="relative group">
              <Building
                className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 transition-all duration-300 ${
                  focusedField === "hostelName" ? "text-emerald-600 scale-110" : "text-slate-400"
                }`}
              />
              <Input
                id="hostelName"
                type="text"
                placeholder="Enter hostel name"
                value={formData.hostelName}
                onChange={(e) => handleInputChange("hostelName", e.target.value)}
                onFocus={() => setFocusedField("hostelName")}
                onBlur={() => setFocusedField(null)}
                className={`pl-10 sm:pl-12 h-12 sm:h-14 transition-all duration-300 border-2 text-sm sm:text-base ${
                  focusedField === "hostelName"
                    ? "border-emerald-300 shadow-lg shadow-emerald-100 scale-[1.02]"
                    : "border-slate-200 hover:border-emerald-200"
                } focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100`}
                required
              />
            </div>
            <div className="space-y-2 sm:space-y-3">
              <Label htmlFor="organization" className="text-slate-700 font-medium text-sm sm:text-base">
                Organization (optional)
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
                  placeholder="Enter organization name (if any)"
                  value={formData.organization}
                  onChange={(e) => handleInputChange("organization", e.target.value)}
                  onFocus={() => setFocusedField("organization")}
                  onBlur={() => setFocusedField(null)}
                  className={`pl-10 sm:pl-12 h-12 sm:h-14 transition-all duration-300 border-2 text-sm sm:text-base ${
                    focusedField === "organization"
                      ? "border-emerald-300 shadow-lg shadow-emerald-100 scale-[1.02]"
                      : "border-slate-200 hover:border-emerald-200"
                  } focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100`}
                />
              </div>
            </div>
          </div>
        )}

        {/* NGO/Admin optional organization */}
        {(formData.userType === 'ngo' || formData.userType === 'admin') && (
          <div className="space-y-2 sm:space-y-3 animate-slide-up delay-200">
            <Label htmlFor="organization" className="text-slate-700 font-medium text-sm sm:text-base">
              Organization (optional)
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
                placeholder="Enter organization name (if any)"
                value={formData.organization}
                onChange={(e) => handleInputChange("organization", e.target.value)}
                onFocus={() => setFocusedField("organization")}
                onBlur={() => setFocusedField(null)}
                className={`pl-10 sm:pl-12 h-12 sm:h-14 transition-all duration-300 border-2 text-sm sm:text-base ${
                  focusedField === "organization"
                    ? "border-emerald-300 shadow-lg shadow-emerald-100 scale-[1.02]"
                    : "border-slate-200 hover:border-emerald-200"
                } focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100`}
              />
            </div>
          </div>
        )}

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
      ) : (
        <form onSubmit={handleVerify} className="space-y-4 sm:space-y-6">
          {error && (
            <Alert variant="destructive" className="animate-slide-up border-red-200 bg-red-50">
              <AlertDescription className="text-red-800">{error}</AlertDescription>
            </Alert>
          )}
          {info && !error && (
            <Alert className="animate-slide-up border-emerald-200 bg-emerald-50">
              <AlertDescription className="text-emerald-800">{info}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2 sm:space-y-3">
            <Label className="text-slate-700 font-medium text-sm sm:text-base">Enter verification code</Label>
            <div>
              {/* Fallback simple input; we also have a styled OTP component in components/ui/input-otp.tsx */}
              <Input
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                className="h-12 sm:h-14 text-center tracking-widest text-lg"
              />
            </div>
            <div className="flex items-center justify-between text-sm text-slate-600">
              <button type="button" onClick={() => setOtpStep(false)} className="underline">Back</button>
              <button type="button" onClick={handleResend} className="underline">Resend code</button>
            </div>
          </div>
          <Button type="submit" className="w-full h-12 sm:h-14 gradient-primary text-white font-semibold">Verify and continue</Button>
        </form>
      )}
    </div>
  )
}
