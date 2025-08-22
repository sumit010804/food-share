"use client"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Leaf from "@/components/leaf-custom"
import { Users, ArrowRight, Sparkles, Heart, MapPin, Phone, Mail, Globe } from "lucide-react"
import { useEffect, useState } from "react"

export default function HomePage() {
  const [meals, setMeals] = useState<number | null>(null)
  const [waste, setWaste] = useState<number | null>(null)
  const [activeUsers, setActiveUsers] = useState<number | null>(null)
  const [loadingStats, setLoadingStats] = useState<boolean>(false)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        setLoadingStats(true)
        const res = await fetch('/api/home-stats', { cache: 'no-store' })
        const js = await res.json().catch(() => ({}))
        if (!mounted) return
        const s = js?.stats || {}
        setMeals(typeof s.mealsRedistributed === 'number' ? s.mealsRedistributed : null)
        setWaste(typeof s.wasteReductionPercent === 'number' ? s.wasteReductionPercent : null)
        setActiveUsers(typeof s.activeUsers === 'number' ? s.activeUsers : null)
      } catch {
        if (!mounted) return
        setMeals(null); setWaste(null); setActiveUsers(null)
      } finally {
        if (mounted) setLoadingStats(false)
      }
    }
    load()
    const id = setInterval(load, 30000)
    return () => { mounted = false; clearInterval(id) }
  }, [])
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30 overflow-hidden">
      {/* Header */}
      <header className="border-b border-emerald-100 bg-white/90 backdrop-blur-md sticky top-0 z-50 animate-fade-in">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 hover-lift">
            <div className="relative">
              <Leaf className="h-8 w-8 text-emerald-600" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-pulse"></div>
            </div>
            <h1 className="text-2xl font-serif font-black text-emerald-800 tracking-tight">FoodShare</h1>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <Link
              href="#about"
              className="text-slate-600 hover:text-emerald-700 transition-all duration-300 font-medium relative group"
            >
              About
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-emerald-600 transition-all duration-300 group-hover:w-full"></span>
            </Link>
            <Link
              href="#impact"
              className="text-slate-600 hover:text-emerald-700 transition-all duration-300 font-medium relative group"
            >
              Impact
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-emerald-600 transition-all duration-300 group-hover:w-full"></span>
            </Link>
            <Link
              href="#contact"
              className="text-slate-600 hover:text-emerald-700 transition-all duration-300 font-medium relative group"
            >
              Contact
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-emerald-600 transition-all duration-300 group-hover:w-full"></span>
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button
                variant="outline"
                className="border-emerald-600 text-emerald-700 hover:bg-emerald-50 bg-transparent hover-lift font-medium"
              >
                Login
              </Button>
            </Link>
            <Link href="/signup">
              <Button className="gradient-primary text-white hover-lift font-medium shadow-lg hover:shadow-emerald-200">
                Sign Up
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-24 px-4 overflow-hidden">
        <div className="absolute top-20 left-10 w-32 h-32 bg-emerald-200/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-emerald-300/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/3 w-24 h-24 bg-emerald-400/10 rounded-full blur-2xl animate-pulse delay-500"></div>

        <div className="container mx-auto text-center max-w-5xl relative z-10">
          <div className="animate-slide-up">
            <Badge className="mb-8 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 px-4 py-2 text-sm font-medium border border-emerald-200 hover-lift">
              <Sparkles className="w-4 h-4 mr-2" />
              Zero-Waste Campus Initiative
            </Badge>
          </div>

          <div className="animate-slide-up delay-100">
            <h2 className="text-5xl md:text-6xl lg:text-7xl font-serif font-black text-slate-800 mb-8 leading-tight">
              Redistributing Surplus,{" "}
              <span className="bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent">
                Nourishing Communities
              </span>
            </h2>
          </div>

          <div className="animate-slide-up delay-200">
            <p className="text-xl md:text-2xl text-slate-600 mb-12 leading-relaxed max-w-4xl mx-auto font-sans">
              Connect surplus food from canteens, hostels, and events with students, staff, and NGOs. Together, we can
              eliminate food waste and build a sustainable campus community.
            </p>
          </div>

          <div className="animate-slide-up delay-300 flex flex-col sm:flex-row gap-6 justify-center items-center">
            <Link href="/signup">
              <Button
                size="lg"
                className="gradient-primary text-white px-10 py-4 text-lg font-semibold hover-lift shadow-xl hover:shadow-emerald-200 group"
              >
                Get Involved
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link href="#about">
              <Button
                size="lg"
                variant="outline"
                className="border-2 border-emerald-600 text-emerald-700 hover:bg-emerald-50 px-10 py-4 text-lg font-semibold bg-transparent hover-lift"
              >
                Learn More
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* About Us Section */}
      <section id="about" className="py-24 px-4 bg-white relative">
        <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-emerald-50/50 to-transparent"></div>

        <div className="container mx-auto max-w-7xl relative z-10">
          <div className="text-center mb-16 animate-fade-in">
            <h3 className="text-4xl md:text-5xl font-serif font-black text-slate-800 mb-6">
              Our Mission:{" "}
              <span className="bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent">
                Zero Food Waste
              </span>
            </h3>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
              Transforming how educational institutions handle surplus food through innovative technology and community
              engagement.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="animate-slide-up">
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-8 rounded-3xl border border-emerald-100">
                <h4 className="text-3xl font-serif font-bold text-slate-800 mb-6">The Problem We're Solving</h4>
                <div className="space-y-4 text-slate-600 leading-relaxed">
                  <p className="text-lg">
                    Every day, educational institutions across India generate massive amounts of surplus food from
                    canteens, hostels, events, and functions. This food, often perfectly edible and nutritious, ends up
                    in waste bins while many students and community members face food insecurity.
                  </p>
                  <p className="text-lg">
                    <strong className="text-emerald-700">The statistics are staggering:</strong> Indian institutions
                    waste approximately 40% of food produced, contributing to environmental degradation through methane
                    emissions from landfills and wasted resources like water, energy, and agricultural inputs.
                  </p>
                </div>
              </div>
            </div>

            <div className="animate-slide-up delay-200">
              <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 p-8 rounded-3xl border border-amber-100">
                <h4 className="text-3xl font-serif font-bold text-slate-800 mb-6">Our Solution</h4>
                <div className="space-y-4 text-slate-600 leading-relaxed">
                  <p className="text-lg">
                    FoodShare creates a seamless digital bridge between food surplus and food need. Our platform enables
                    canteen managers, hostel wardens, and event organizers to instantly notify the campus community
                    about available surplus food.
                  </p>
                  <p className="text-lg">
                    <strong className="text-amber-700">Real-time coordination</strong> ensures food reaches those who
                    need it most - students, staff, and partnered NGOs - before it spoils. Every meal saved is a step
                    toward environmental sustainability and social responsibility.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-16 animate-fade-in delay-300">
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 p-12 rounded-3xl text-white text-center">
              <h4 className="text-3xl font-serif font-bold mb-6">Environmental Impact</h4>
              <div className="grid md:grid-cols-3 gap-8 text-center">
                <div>
                  <div className="text-4xl font-bold mb-2">1.3 Billion</div>
                  <div className="text-emerald-100">Tons of food wasted globally each year</div>
                </div>
                <div>
                  <div className="text-4xl font-bold mb-2">8-10%</div>
                  <div className="text-emerald-100">Of global greenhouse gas emissions from food waste</div>
                </div>
                <div>
                  <div className="text-4xl font-bold mb-2">25%</div>
                  <div className="text-emerald-100">Of world's freshwater used for wasted food</div>
                </div>
              </div>
              <p className="text-xl mt-8 text-emerald-100 leading-relaxed max-w-4xl mx-auto">
                By redistributing surplus food instead of wasting it, we're not just feeding people - we're protecting
                our planet. Every meal saved reduces carbon footprint, conserves water, and prevents methane emissions
                from landfills.
              </p>
            </div>
          </div>

          <div className="mt-16 grid md:grid-cols-2 gap-12 animate-slide-up delay-400">
            <div className="bg-white p-8 rounded-3xl shadow-xl border border-emerald-100">
              <h4 className="text-2xl font-serif font-bold text-slate-800 mb-4">Community Building</h4>
              <p className="text-slate-600 leading-relaxed text-lg">
                Beyond waste reduction, FoodShare fosters a culture of sharing and community care. Students learn the
                value of resources, staff contribute to meaningful causes, and NGOs receive consistent support for their
                programs.
              </p>
            </div>
            <div className="bg-white p-8 rounded-3xl shadow-xl border border-emerald-100">
              <h4 className="text-2xl font-serif font-bold text-slate-800 mb-4">Technology for Good</h4>
              <p className="text-slate-600 leading-relaxed text-lg">
                Our smart platform uses real-time notifications, food safety tracking, and impact analytics to ensure
                efficient, safe, and measurable food redistribution that creates lasting positive change.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Impact Section */}
      <section
        id="impact"
        className="py-24 px-4 bg-gradient-to-br from-emerald-50 to-emerald-100/50 relative overflow-hidden"
      >
        <div className="absolute top-10 left-20 w-20 h-20 bg-emerald-300/20 rounded-full blur-2xl animate-pulse"></div>
        <div className="absolute bottom-10 right-20 w-32 h-32 bg-emerald-400/20 rounded-full blur-3xl animate-pulse delay-700"></div>

        <div className="container mx-auto max-w-6xl text-center relative z-10">
          <div className="animate-fade-in">
            <h3 className="text-4xl md:text-5xl font-serif font-black text-slate-800 mb-12 leading-tight">
              Together, We Can Make a Difference –{" "}
              <span className="bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent">
                One Meal at a Time
              </span>
            </h3>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="bg-white/80 backdrop-blur-sm p-10 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 hover-lift border border-emerald-100 animate-scale-in">
              <div className="text-5xl font-serif font-black gradient-primary bg-clip-text text-transparent mb-2">
                {loadingStats && meals === null ? '…' : (meals ?? 0).toLocaleString()}
              </div>
              <div className="text-slate-600 text-lg font-medium">Meals Redistributed</div>
              <Heart className="w-6 h-6 text-emerald-500 mx-auto mt-4" />
            </div>
            <div className="bg-white/80 backdrop-blur-sm p-10 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 hover-lift border border-emerald-100 animate-scale-in delay-100">
              <div className="text-5xl font-serif font-black gradient-primary bg-clip-text text-transparent mb-2">
                {loadingStats && waste === null ? '…' : `${Math.round(waste ?? 0)}%`}
              </div>
              <div className="text-slate-600 text-lg font-medium">Waste Reduction</div>
              <Leaf className="w-6 h-6 text-emerald-500 mx-auto mt-4" />
            </div>
            <div className="bg-white/80 backdrop-blur-sm p-10 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 hover-lift border border-emerald-100 animate-scale-in delay-200">
              <div className="text-5xl font-serif font-black gradient-primary bg-clip-text text-transparent mb-2">
                {loadingStats && activeUsers === null ? '…' : (activeUsers ?? 0).toLocaleString()}
              </div>
              <div className="text-slate-600 text-lg font-medium">Active Users</div>
              <Users className="w-6 h-6 text-emerald-500 mx-auto mt-4" />
            </div>
          </div>

          <div className="animate-slide-up delay-300">
            <p className="text-xl text-slate-600 mb-12 leading-relaxed max-w-4xl mx-auto">
              Join our growing community of students, staff, and organizations committed to creating a sustainable
              campus environment.
            </p>
            <Link href="/signup">
              <Button
                size="lg"
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white px-12 py-4 text-lg font-semibold hover-lift shadow-xl hover:shadow-amber-200 group"
              >
                Get Real-Time Updates on Food Availability
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Contact Us Section */}
      <section id="contact" className="py-24 px-4 bg-white relative">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16 animate-fade-in">
            <h3 className="text-4xl md:text-5xl font-serif font-black text-slate-800 mb-6">
              Get in{" "}
              <span className="bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent">
                Touch
              </span>
            </h3>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
              Ready to join the zero-waste movement? Contact us to learn more about implementing FoodShare at your
              institution.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-16">
            <div className="animate-slide-up">
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-8 rounded-3xl border border-emerald-100">
                <h4 className="text-2xl font-serif font-bold text-slate-800 mb-8">Contact Information</h4>

                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h5 className="font-semibold text-slate-800 mb-2">Address</h5>
                      <p className="text-slate-600 leading-relaxed">
                        Heritage Institute of Technology
                        <br />
                        Kolkata, West Bengal
                        <br />
                        India
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <Phone className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h5 className="font-semibold text-slate-800 mb-2">Phone</h5>
                      <p className="text-slate-600">+91 908080594</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <Mail className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h5 className="font-semibold text-slate-800 mb-2">Email</h5>
                      <p className="text-slate-600">sumitkumar8489@gmail.com</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <Globe className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h5 className="font-semibold text-slate-800 mb-2">Inspiration</h5>
                      <p className="text-slate-600">
                        Learn more about social impact initiatives at{" "}
                        <a
                          href="https://balrakshabharat.org/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-600 hover:text-emerald-700 underline transition-colors"
                        >
                          balrakshabharat.org
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="animate-slide-up delay-200">
              <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 p-8 rounded-3xl border border-amber-100">
                <h4 className="text-2xl font-serif font-bold text-slate-800 mb-6">Ready to Make a Difference?</h4>
                <p className="text-slate-600 leading-relaxed text-lg mb-8">
                  Whether you're a student, faculty member, administrator, or NGO representative, there's a place for
                  you in our mission to eliminate food waste and build stronger communities.
                </p>

                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-2xl border border-amber-200">
                    <h5 className="font-semibold text-slate-800 mb-2">For Institutions</h5>
                    <p className="text-slate-600">
                      Implement FoodShare at your campus and start making an impact today.
                    </p>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-amber-200">
                    <h5 className="font-semibold text-slate-800 mb-2">For NGOs</h5>
                    <p className="text-slate-600">
                      Partner with us to receive regular surplus food donations for your programs.
                    </p>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-amber-200">
                    <h5 className="font-semibold text-slate-800 mb-2">For Developers</h5>
                    <p className="text-slate-600">Contribute to our open-source mission and help scale the impact.</p>
                  </div>
                </div>

                <div className="mt-8">
                  <Link href="/signup">
                    <Button
                      size="lg"
                      className="w-full gradient-primary text-white py-4 text-lg font-semibold hover-lift shadow-xl hover:shadow-emerald-200 group"
                    >
                      Join the Movement
                      <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gradient-to-br from-slate-800 to-slate-900 text-white py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="grid md:grid-cols-4 gap-12">
            <div className="animate-fade-in">
              <div className="flex items-center gap-3 mb-6">
                <Leaf className="h-8 w-8 text-emerald-400" />
                <span className="text-2xl font-serif font-black">FoodShare</span>
              </div>
              <p className="text-slate-300 leading-relaxed text-lg">
                Building a sustainable campus through smart food redistribution.
              </p>
            </div>
            <div className="animate-fade-in delay-100">
              <h4 className="font-serif font-bold text-xl mb-6">Platform</h4>
              <ul className="space-y-3 text-slate-300">
                <li>
                  <Link href="/dashboard" className="hover:text-emerald-400 transition-colors duration-300">
                    Dashboard
                  </Link>
                </li>
                <li>
                  <Link href="/analytics" className="hover:text-emerald-400 transition-colors duration-300">
                    Analytics
                  </Link>
                </li>
                <li>
                  <Link href="/api" className="hover:text-emerald-400 transition-colors duration-300">
                    API
                  </Link>
                </li>
              </ul>
            </div>
            <div className="animate-fade-in delay-200">
              <h4 className="font-serif font-bold text-xl mb-6">Community</h4>
              <ul className="space-y-3 text-slate-300">
                <li>
                  <Link href="#about" className="hover:text-emerald-400 transition-colors duration-300">
                    About
                  </Link>
                </li>
                <li>
                  <Link href="#impact" className="hover:text-emerald-400 transition-colors duration-300">
                    Impact
                  </Link>
                </li>
                <li>
                  <Link href="#contact" className="hover:text-emerald-400 transition-colors duration-300">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
            <div className="animate-fade-in delay-300">
              <h4 className="font-serif font-bold text-xl mb-6">Support</h4>
              <ul className="space-y-3 text-slate-300">
                <li>
                  <Link href="/help" className="hover:text-emerald-400 transition-colors duration-300">
                    Help Center
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="hover:text-emerald-400 transition-colors duration-300">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-emerald-400 transition-colors duration-300">
                    Terms
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-700 mt-12 pt-8 text-center text-slate-300 animate-fade-in delay-400">
            <p>&copy; 2024 FoodShare. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
