import { useState, useEffect, useRef } from "react";
import { Camera, Mail, Phone, User as UserIcon, Shield, FileText, Loader2, Check, Briefcase, Award, Hash } from "lucide-react";
import { useUser, ApiUser } from "@/context/UserContext";
import api from "@/services/api";

export default function Profile() {
  const { user } = useUser();
  const [profile, setProfile] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    bio: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get("/profile/");
        console.log("FULL USER RESPONSE:", res.data);

        // Map department robustly handling string, null, or potential nested objects
        let dept = res.data.department || res.data.departmentName || res.data.dept || "";
        if (dept && typeof dept === "object") {
          dept = dept.name || dept.id || "";
        }

        const mappedData = { ...res.data, department: dept };
        setProfile(mappedData);
        setFormData({
          first_name: res.data.first_name || "",
          last_name: res.data.last_name || "",
          phone: res.data.phone || "",
          bio: res.data.bio || "",
        });
        if (res.data.profile_image) {
          setImagePreview(res.data.profile_image);
        }
      } catch (err) {
        console.error("Failed to fetch profile", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);

    try {
      const data = new FormData();
      data.append("first_name", formData.first_name);
      data.append("last_name", formData.last_name);
      data.append("phone", formData.phone);
      data.append("bio", formData.bio);
      
      if (imageFile) {
        data.append("profile_image", imageFile);
      }

      const res = await api.patch("/profile/", data, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      setProfile(res.data);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to update profile", err);
      alert("Failed to update profile. Check console for details.");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !profile) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  console.log("USER DATA:", user);

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in pb-12">
      <div>
        <h2 className="font-display text-2xl font-bold">My Profile</h2>
        <p className="text-sm text-muted-foreground mt-1">Manage your personal information and preferences.</p>
      </div>

      <div className="glass-card overflow-hidden">
        {/* Banner */}
        <div className="h-32 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent flex items-end px-8 pb-4 relative">
          <div className="absolute inset-0 bg-grid-white/[0.02]" />
        </div>

        <form onSubmit={handleSubmit} className="p-8 pt-0 relative">
          {/* Avatar Upload */}
          <div className="relative -mt-16 mb-8 flex items-end gap-5">
            <div className="relative group">
              <div className="h-28 w-28 rounded-2xl bg-secondary border-4 border-card shadow-lg overflow-hidden flex items-center justify-center relative">
                {imagePreview ? (
                  <img src={imagePreview} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full bg-primary/10 flex items-center justify-center text-3xl font-bold text-primary">
                    {profile.username[0].toUpperCase()}
                  </div>
                )}
                {/* Upload Overlay */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <Camera className="h-6 w-6 mb-1" />
                  <span className="text-xs font-semibold">Change</span>
                </button>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageChange}
                accept="image/*"
                className="hidden"
              />
            </div>
            <div className="pb-3">
              <h3 className="text-xl font-display font-bold">{profile.first_name} {profile.last_name || profile.username}</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <Shield className="h-3.5 w-3.5" />
                <span className="capitalize">{profile.role} Access</span>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-2">
                  <UserIcon className="h-4 w-4 text-muted-foreground" /> First Name
                </label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="Jane"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Last Name</label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="Doe"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" /> Email Address
              </label>
              <input
                type="email"
                value={profile.email}
                disabled
                className="input-field opacity-60 cursor-not-allowed bg-secondary/50"
              />
              <p className="text-[10px] text-muted-foreground ml-1">Email cannot be changed directly. Contact an admin.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" /> Phone Number
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="input-field"
                placeholder="+1 (555) 000-0000"
              />
            </div>

            {/* Additional Details */}
            <div className="grid sm:grid-cols-3 gap-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Award className="h-4 w-4 text-muted-foreground" /> Seniority
                </label>
                <input
                  type="text"
                  value={profile.seniority || "Junior"}
                  disabled
                  className="input-field opacity-60 cursor-not-allowed bg-secondary/50"
                />
              </div>
              <div className="space-y-1.5">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground" /> Department
                  </label>
                  <input
                    type="text"
                    value={
                      profile.department && typeof profile.department === "string" && profile.department.trim() !== ""
                        ? profile.department
                        : "Not Assigned"
                    }
                    disabled
                    className="input-field opacity-60 cursor-not-allowed bg-secondary/50"
                  />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Hash className="h-4 w-4 text-muted-foreground" /> User ID
                </label>
                <input
                  type="text"
                  value={profile.id ? `WK-${profile.id.toString().padStart(4, '0')}` : "Not Assigned"}
                  disabled
                  className="input-field opacity-60 cursor-not-allowed bg-secondary/50"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" /> Bio
              </label>
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                rows={3}
                className="input-field resize-none"
                placeholder="A brief description about yourself and your role..."
              />
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-border flex items-center gap-4">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {saving ? "Saving..." : "Save Changes"}
            </button>
            {success && (
              <span className="text-sm text-success flex items-center gap-1.5 animate-in fade-in slide-in-from-left-2">
                <Check className="h-4 w-4" /> Profile updated successfully
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
