// add-post.js - الإصدار المحسن للنشر على GitHub
import { 
  auth, database, storage, serverTimestamp,
  ref, set, push, storageRef, uploadBytesResumable, getDownloadURL,
  onAuthStateChanged
} from './firebase.js';

// عناصر DOM
const addPostForm = document.getElementById('add-post-form');
const postImageInput = document.getElementById('post-image');
const chooseImageBtn = document.getElementById('choose-image-btn');
const cameraBtn = document.getElementById('camera-btn');
const imageName = document.getElementById('image-name');
const imagePreview = document.getElementById('image-preview');
const previewImg = document.getElementById('preview-img');
const removeImageBtn = document.getElementById('remove-image-btn');
const publishBtn = document.getElementById('publish-btn');
const loadingOverlay = document.getElementById('loading-overlay');
const uploadProgress = document.getElementById('upload-progress');
const adminIcon = document.getElementById('admin-icon');

// متغيرات النظام
let currentUserData = null;
let selectedFile = null;

// تحميل بيانات المستخدم عند بدء التحميل
document.addEventListener('DOMContentLoaded', () => {
    console.log('صفحة إضافة منشور تم تحميلها');
    checkAuthState();
    setupEventListeners();
});

// إعداد مستمعي الأحداث
function setupEventListeners() {
    // اختيار صورة من المعرض
    chooseImageBtn.addEventListener('click', () => {
        postImageInput.removeAttribute('capture');
        postImageInput.click();
    });

    // فتح الكاميرا
    cameraBtn.addEventListener('click', () => {
        postImageInput.setAttribute('capture', 'environment');
        postImageInput.click();
    });

    // عرض معاينة الصورة
    postImageInput.addEventListener('change', handleImageSelect);

    // إزالة الصورة المختارة
    removeImageBtn.addEventListener('click', removeSelectedImage);

    // نشر منشور جديد
    addPostForm.addEventListener('submit', handlePublishPost);
}

// التحقق من حالة المصادقة
function checkAuthState() {
    onAuthStateChanged(auth, user => {
        if (!user) {
            alert('يجب تسجيل الدخول أولاً');
            window.location.href = 'auth.html';
            return;
        }
        
        // تحميل بيانات المستخدم الحالي
        const userRef = ref(database, 'users/' + user.uid);
        onValue(userRef, (snapshot) => {
            if (snapshot.exists()) {
                currentUserData = snapshot.val();
                currentUserData.uid = user.uid;
                
                if (currentUserData.isAdmin) {
                    adminIcon.style.display = 'flex';
                }
            }
        }, { onlyOnce: true });
    });
}

// معالجة اختيار الصورة
function handleImageSelect() {
    if (this.files && this.files[0]) {
        selectedFile = this.files[0];
        imageName.textContent = selectedFile.name;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            previewImg.src = e.target.result;
            imagePreview.classList.remove('hidden');
        }
        reader.readAsDataURL(selectedFile);
    }
}

// إزالة الصورة المختارة
function removeSelectedImage() {
    postImageInput.value = '';
    selectedFile = null;
    imageName.textContent = 'لم يتم اختيار صورة';
    imagePreview.classList.add('hidden');
}

// معالجة نشر المنشور
async function handlePublishPost(e) {
    e.preventDefault();
    
    const user = auth.currentUser;
    if (!user) {
        alert('يجب تسجيل الدخول أولاً');
        window.location.href = 'auth.html';
        return;
    }
    
    const title = document.getElementById('post-title').value.trim();
    const description = document.getElementById('post-description').value.trim();
    const price = document.getElementById('post-price').value.trim();
    const location = document.getElementById('post-location').value.trim();
    const phone = document.getElementById('post-phone').value.trim();
    
    if (!title || !description) {
        alert('يرجى ملء العنوان والوصف');
        return;
    }
    
    showLoading();
    
    try {
        let imageUrl = '';
        
        // رفع الصورة إذا تم اختيارها
        if (selectedFile) {
            try {
                // التحقق من حجم الصورة (حد أقصى 5MB)
                if (selectedFile.size > 5 * 1024 * 1024) {
                    throw new Error('حجم الصورة كبير جداً. الحد الأقصى هو 5MB');
                }
                
                imageUrl = await uploadImage(selectedFile, user.uid);
            } catch (uploadError) {
                console.error('Error uploading image:', uploadError);
                const shouldContinue = confirm('حدث خطأ في رفع الصورة. هل تريد متابعة النشر بدون صورة؟');
                if (!shouldContinue) {
                    hideLoading();
                    return;
                }
            }
        }
        
        // حفظ بيانات المنشور في قاعدة البيانات
        const postData = {
            title: title,
            description: description,
            price: price || 'غير محدد',
            location: location || 'غير محدد',
            phone: phone || 'غير متاح',
            imageUrl: imageUrl,
            authorId: user.uid,
            authorName: currentUserData.name || 'مستخدم',
            createdAt: Date.now(),
            timestamp: serverTimestamp()
        };
        
        const postsRef = ref(database, 'posts');
        const newPostRef = push(postsRef);
        await set(newPostRef, postData);
        
        alert('تم نشر المنشور بنجاح!');
        resetForm();
        window.location.href = 'index.html';
        
    } catch (error) {
        console.error('Error publishing post:', error);
        
        // رسائل خطأ أكثر تحديداً
        let errorMessage = 'حدث خطأ أثناء نشر المنشور. ';
        
        if (error.code === 'storage/unauthorized') {
            errorMessage += 'ليس لديك صلاحية رفع الصور.';
        } else if (error.code === 'storage/retry-limit-exceeded') {
            errorMessage += 'فشلت عملية رفع الصورة بعد عدة محاولات. يرجى المحاولة مرة أخرى.';
        } else if (error.code === 'storage/canceled') {
            errorMessage += 'تم إلغاء عملية رفع الصورة.';
        } else if (error.code) {
            errorMessage += `خطأ: ${error.code}`;
        } else {
            errorMessage += 'يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى.';
        }
        
        alert(errorMessage);
    } finally {
        hideLoading();
    }
}

// رفع الصورة إلى التخزين
async function uploadImage(file, userId) {
    return new Promise((resolve, reject) => {
        // إضافة طابع زمني لاسم الملف لمنع التكرار
        const timestamp = Date.now();
        const fileExtension = file.name.split('.').pop();
        const fileName = `post_${timestamp}.${fileExtension}`;
        
        const storagePath = `posts/${userId}/${fileName}`;
        const imageRef = storageRef(storage, storagePath);
        
        // تحديد نوع MIME للصورة
        const metadata = {
            contentType: file.type
        };
        
        const uploadTask = uploadBytesResumable(imageRef, file, metadata);
        
        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                uploadProgress.style.width = progress + '%';
            },
            (error) => {
                reject(error);
            },
            async () => {
                try {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    resolve(downloadURL);
                } catch (error) {
                    reject(error);
                }
            }
        );
    });
}

// إعادة تعيين النموذج
function resetForm() {
    addPostForm.reset();
    postImageInput.value = '';
    selectedFile = null;
    imageName.textContent = 'لم يتم اختيار صورة';
    imagePreview.classList.add('hidden');
}

// وظائف مساعدة
function showLoading() {
    if (loadingOverlay) loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
    if (loadingOverlay) {
        loadingOverlay.classList.add('hidden');
        uploadProgress.style.width = '0%';
    }
        }
