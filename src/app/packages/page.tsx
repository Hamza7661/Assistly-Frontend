'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usePackageService, useAuthService } from '@/services';
import { Package } from '@/models/Package';
import { PackageType } from '@/enums/PackageType';
import { ArrowLeft, Plus, Check, X } from 'lucide-react';
import styles from './styles.module.css';
import { User } from '@/models/User';
import { ProtectedRoute, Spinner } from '@/components';

export default function PackagesPage() {
  const router = useRouter();
  const { user, updateUser } = useAuth();
  const [packages, setPackages] = useState<Package[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [selectingPackageId, setSelectingPackageId] = useState<string | null>(null);

  const [customPackage, setCustomPackage] = useState({
    chatbotQueries: 0,
    voiceMinutes: 0,
    leadGeneration: false
  });

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      const packageService = await usePackageService();
      const response = await packageService.getPackages();
      setPackages(response.data.packages.map((pkg: any) => new Package(pkg)));
    } catch (err: any) {
      setError('Failed to fetch packages');
      console.error('Error fetching packages:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePackageSelect = async (pkg: Package) => {
    if (!user) return;
    
    setSelectingPackageId(pkg._id);
    try {
      const authService = await useAuthService();
      const response = await authService.updateUserProfile(user._id, {
        package: pkg._id
      });
      
            if (response.status === 'success') {
        // Update the user context with the new package
        const updatedUser = new User({ ...user, package: pkg });
        updateUser(updatedUser);
        setSelectedPackage(pkg);
        setSelectingPackageId(null); // Stop loader immediately after package selection
        
        // Redirect to dashboard
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError('Failed to select package. Please try again.');
      setSelectingPackageId(null);
    }
  };



  const handleCustomPackageSubmit = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const packageService = await usePackageService();
      const response = await packageService.createCustomPackage({
        type: PackageType.CUSTOM,
        price: {
          amount: Math.max(20, Math.floor((customPackage.chatbotQueries / 20000) * 20 + (customPackage.voiceMinutes / 2000) * 20)),
          currency: 'USD',
          billingCycle: 'monthly'
        },
        limits: {
          chatbotQueries: customPackage.chatbotQueries === 0 ? 0 : customPackage.chatbotQueries,
          voiceMinutes: customPackage.voiceMinutes === 0 ? 0 : customPackage.voiceMinutes,
          leadGeneration: customPackage.leadGeneration ? -1 : 0
        },
        features: {
          chatbot: true,
          voiceAgent: true,
          leadGeneration: customPackage.leadGeneration
        }
      });

      if (response.status === 'success') {
        // Update user with the new custom package
        const authService = await useAuthService();
        await authService.updateUserProfile(user._id, {
          package: response.data.package._id
        });
        
        setShowCustomModal(false);
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError('Failed to create custom package. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderFeaturesFromDescription = (description: string) => {
    if (!description) return null;
    const features = description.split('.').filter(feature => feature.trim().length > 0);
    return (
      <div className={styles.featuresList}>
        {features.map((feature, index) => (
          <div key={index} className={styles.featureItem}>
            <div className={styles.featureBullet}></div>
            <span className={styles.featureText}>{feature.trim()}</span>
          </div>
        ))}
      </div>
    );
  };



  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.pageContainer}>
          <div className="flex justify-center items-center h-64">
            <div className="loading-spinner"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className={styles.container}>
        <div className={styles.pageHeader}>
        <div className={styles.pageHeaderContent}>
          <div className={styles.pageHeaderInner}>
            <button onClick={() => router.back()} className={styles.backButton}>
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center">
              <div className={styles.logoIcon}>
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <h1 className={styles.pageTitle}>Choose Your Package</h1>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.pageContainer}>
        {user && !user.hasPackage() && (
          <div className={styles.welcomeBanner}>
            <h2 className={styles.welcomeTitle}>Welcome to Assistly, {user.firstName}! 🎉</h2>
            <p className={styles.welcomeSubtitle}>
              Choose the perfect package to get started with your virtual assistant journey.
            </p>
          </div>
        )}

        {user && user.hasPackage() && (
          <div className={styles.currentPackageBanner}>
            <h2 className={styles.currentPackageTitle}>Your Current Package</h2>
            <div className={styles.currentPackageCard}>
              <div className={styles.currentPackageInfo}>
                <h3 className={styles.currentPackageName}>
                  {user.package?.type === PackageType.CUSTOM ? 'Custom Package' : user.package?.name}
                </h3>
                <p className={styles.currentPackagePrice}>
                  ${typeof user.package?.price === 'object' ? user.package.price.amount : user.package?.price} per month
                </p>
                {user.package?.type === PackageType.CUSTOM && (
                  <div className={styles.customPackageDetails}>
                    <p className={styles.customPackageLimits}>
                      {user.package.limits.chatbotQueries > 0 && `${user.package.limits.chatbotQueries.toLocaleString()} chatbot queries`}
                      {user.package.limits.voiceMinutes > 0 && ` • ${user.package.limits.voiceMinutes.toLocaleString()} voice minutes`}
                      {user.package.limits.leadGeneration > 0 && ` • Lead generation`}
                    </p>
                  </div>
                )}
              </div>
              <div className={styles.currentPackageStatus}>
                <span className={styles.currentPackageBadge}>Active</span>
              </div>
            </div>
          </div>
        )}

        {error && <div className="error-message mb-6">{error}</div>}

        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Available Packages</h2>
          <p className={styles.sectionDescription}>
            Select the package that best fits your needs and budget
          </p>
          <div className={styles.subscriptionNote}>
            <p className={styles.subscriptionNoteText}>
              💳 You can cancel your subscription anytime - no long-term commitments required
            </p>
          </div>
        </div>

        <div className={styles.packagesGrid}>
          {packages.map((pkg) => {
            const isCurrentPackage = user?.package?._id === pkg._id;
            return (
              <div key={pkg._id} className={`${styles.packageCard} ${isCurrentPackage ? styles.currentPackageCardGrid : ''}`}>
                {pkg.isPopular && (
                  <div className={styles.popularBadge}>Most Popular</div>
                )}
                {isCurrentPackage && (
                  <div className={styles.currentPackageBadgeGrid}>Current Package</div>
                )}
                <div className={styles.packageHeader}>
                  <h3 className={styles.packageName}>
                    {pkg.type === PackageType.CUSTOM ? 'Custom Package' : pkg.name}
                  </h3>
                  <div className={styles.packagePrice}>${typeof pkg.price === 'object' ? pkg.price.amount : pkg.price}</div>
                  <p className={styles.packageBilling}>per month</p>
                </div>

                <div className={styles.packageSection}>
                  <h4 className={styles.packageSectionTitle}>Limits</h4>
                  <div className={styles.limitsGrid}>
                    <div className={styles.limitItem}>
                      <div className={styles.limitValue}>
                        {pkg.limits.chatbotQueries === -1 ? 'Unlimited' : pkg.limits.chatbotQueries.toLocaleString()}
                      </div>
                      <div className={styles.limitLabel}>Chatbot Queries</div>
                    </div>
                    <div className={styles.limitItem}>
                      <div className={styles.limitValue}>
                        {pkg.limits.voiceMinutes === -1 ? 'Unlimited' : pkg.limits.voiceMinutes.toLocaleString()}
                      </div>
                      <div className={styles.limitLabel}>Voice Minutes</div>
                    </div>
                    <div className={styles.limitItem}>
                      <div className={styles.limitValue}>
                        {pkg.limits.leadGeneration === -1 ? 'Unlimited' : pkg.limits.leadGeneration}
                      </div>
                      <div className={styles.limitLabel}>Lead Generation</div>
                    </div>
                  </div>
                </div>

                <div className={styles.packageSection}>
                  <h4 className={styles.packageSectionTitle}>Features</h4>
                  {renderFeaturesFromDescription(pkg.description)}
                </div>

                <div className={styles.packageButtonContainer}>
                  {isCurrentPackage ? (
                    <button
                      disabled
                      className="btn-secondary w-full opacity-75 cursor-not-allowed"
                    >
                      Current Package
                    </button>
                  ) : (
                    <button
                      onClick={() => handlePackageSelect(pkg)}
                      disabled={!!selectingPackageId}
                      className="btn-primary w-full"
                    >
                      {selectingPackageId === pkg._id ? (
                        <>
                          <Spinner size="sm" color="white" />
                          Loading...
                        </>
                      ) : (
                        'Select Package'
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className={styles.customPackageSection}>
          <div className={styles.customPackageCard}>
            <h3 className={styles.customPackageTitle}>Need something custom?</h3>
            <p className={styles.customPackageDescription}>
              Create a package tailored to your specific requirements
            </p>
            <div className={styles.customPackageButtons}>
              <button onClick={() => setShowCustomModal(true)} className="btn-secondary flex items-center justify-center">
                <Plus className="h-5 w-5 mr-2" />
                Create Custom Package
              </button>
              {user && user.hasPackage() && (
                <button onClick={() => router.push('/dashboard')} className="btn-primary flex items-center justify-center">
                  Go to App Now
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Custom Package Modal */}
      {showCustomModal && (
        <div className={styles.modalOverlay} onClick={() => setShowCustomModal(false)}>
          <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Create Custom Package</h3>
              <button onClick={() => setShowCustomModal(false)} className={styles.modalClose}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className={styles.modalContent}>
              <div className={styles.formGroup}>
                <div className={styles.slidersContainer}>
                  <div className={styles.sliderGroup}>
                    <label className={styles.formLabel}>Chatbot Queries</label>
                    <div className={styles.sliderContainer}>
                      <div className={styles.sliderMarks}>
                        <span className={styles.mark}>None</span>
                        <span className={styles.mark}>20</span>
                        <span className={styles.mark}>40</span>
                        <span className={styles.mark}>60</span>
                        <span className={styles.mark}>80</span>
                        <span className={styles.mark}>100</span>
                        <span className={styles.mark}>Unlimited</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="6"
                        step="1"
                        value={customPackage.chatbotQueries === 0 ? 0 : Math.ceil(customPackage.chatbotQueries / 20000)}
                        onChange={(e) => {
                          const step = parseInt(e.target.value);
                          const value = step === 0 ? 0 : step === 6 ? 100000 : step * 20000;
                          setCustomPackage(prev => ({ ...prev, chatbotQueries: value }));
                        }}
                        className={styles.horizontalSlider}
                      />
                      <div className={styles.sliderValue}>
                        {customPackage.chatbotQueries === 0 ? 'None' : customPackage.chatbotQueries.toLocaleString()}
                      </div>
                    </div>
                    <div className={styles.sliderLabel}>queries</div>
                  </div>

                  <div className={styles.sliderGroup}>
                    <label className={styles.formLabel}>Voice Minutes</label>
                    <div className={styles.sliderContainer}>
                      <div className={styles.sliderMarks}>
                        <span className={styles.mark}>None</span>
                        <span className={styles.mark}>20</span>
                        <span className={styles.mark}>40</span>
                        <span className={styles.mark}>60</span>
                        <span className={styles.mark}>80</span>
                        <span className={styles.mark}>100</span>
                        <span className={styles.mark}>Unlimited</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="6"
                        step="1"
                        value={customPackage.voiceMinutes === 0 ? 0 : Math.ceil(customPackage.voiceMinutes / 2000)}
                        onChange={(e) => {
                          const step = parseInt(e.target.value);
                          const value = step === 0 ? 0 : step === 6 ? 10000 : step * 2000;
                          setCustomPackage(prev => ({ ...prev, voiceMinutes: value }));
                        }}
                        className={styles.horizontalSlider}
                      />
                      <div className={styles.sliderValue}>
                        {customPackage.voiceMinutes === 0 ? 'None' : customPackage.voiceMinutes.toLocaleString()}
                      </div>
                    </div>
                    <div className={styles.sliderLabel}>minutes</div>
                  </div>
                </div>

                <div className={styles.toggleGroup}>
                  <label className={styles.formLabel}>Lead Generation</label>
                  <div className={styles.toggleContainer}>
                    <input
                      type="checkbox"
                      id="leadGeneration"
                      checked={customPackage.leadGeneration}
                      onChange={(e) => setCustomPackage(prev => ({ ...prev, leadGeneration: e.target.checked }))}
                      className={styles.toggleCheckbox}
                    />
                    <label htmlFor="leadGeneration" className={styles.toggleLabel}>
                      Enable lead generation tools
                    </label>
                  </div>
                </div>

                <div className={styles.priceDisplay}>
                  <div className={styles.priceRow}>
                    <span className={styles.priceLabel}>Monthly Price:</span>
                    <span className={styles.priceAmount}>
                      {customPackage.chatbotQueries === 0 && customPackage.voiceMinutes === 0 && !customPackage.leadGeneration 
                        ? 'Select features' 
                        : `$${Math.max(20, Math.floor((customPackage.chatbotQueries / 20000) * 20 + (customPackage.voiceMinutes / 2000) * 20))}`
                      }
                    </span>
                  </div>
                  <p className={styles.pricePeriod}>billed monthly</p>
                </div>
              </div>

              <div className={styles.modalActions}>
                <button onClick={() => setShowCustomModal(false)} className="btn-secondary action-button">
                  Cancel
                </button>
                <button 
                  onClick={handleCustomPackageSubmit} 
                  disabled={isLoading || (customPackage.chatbotQueries === 0 && customPackage.voiceMinutes === 0 && !customPackage.leadGeneration)}
                  className="btn-primary action-button disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <Spinner size="sm" color="white" />
                      Creating Package...
                    </>
                  ) : (
                    'Select Package'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </ProtectedRoute>
  );
}



