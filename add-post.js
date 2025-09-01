// استيراد دوال Firebase
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
    checkAuthState();
});

// التحقق من حالة المصادقة
function checkAuthState() {
    onAuthStateChanged(auth, user => {
        if (!user) {
            // توجيه إلى صفحة التسجيل إذا لم يكن المستخدم مسجلاً
            window.location.href = 'auth.html';
            return;
        }
        
        // تحميل بيانات المستخدم الحالي
        const userRef = ref(database, 'users/' + user.uid);
        onValue(userRef, (snapshot) => {
            if (snapshot.exists()) {
                currentUserData = snapshot.val();
                currentUserData.uid = user.uid;
                
                // إظهار أيقونة الإدارة إذا كان المستخدم مشرفاً
                if (currentUserData.isAdmin) {
                    adminIcon.style.display = 'flex';
                }
            }
        });
    });
}

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
postImageInput.addEventListener('change', function() {
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
});

// إزالة الصورة المختارة
removeImageBtn.addEventListener('click', () => {
    postImageInput.value = '';
    selectedFile = null;
    imageName.textContent = 'لم يتم اختيار صورة';
    imagePreview.classList.add('hidden');
});





// ... الكود السابق ...

// تعديل دالة نشر المنشور
addPostForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const user = auth.currentUser;
    if (!user) {
        alert('يجب تسجيل الدخول أولاً');
        window.location.href = 'auth.html';
        return;
    }
    
    const title = document.getElementById('post-title').value;
    const description = document.getElementById('post-description').value;
    const price = document.getElementById('post-price').value;
    const location = document.getElementById('post-location').value;
    const phone = document.getElementById('post-phone').value;
    
    if (!title || !description) {
        alert('يرجى ملء العنوان والوصف');
        return;
    }
    
    showLoading();
    
    try {
        let imageUrl = '';
        
        // رفع الصورة إذا تم اختيارها
        if (selectedFile) {
            // إضافة تاريخ لاسم الملف لمنع التكرار
            const timestamp = Date.now();
            const fileName = `${timestamp}_${selectedFile.name}`;
            imageUrl = await uploadImage(selectedFile, user.uid, fileName);
        }
        
        // حفظ بيانات المنشور في قاعدة البيانات
        const postData = {
            title: title,
            description: description,
            price: price,
            location: location,
            phone: phone,
            imageUrl: imageUrl,
            authorId: user.uid,
            authorName: currentUserData.name || 'مستخدم',
            createdAt: serverTimestamp()
        };
        
        const postsRef = ref(database, 'posts');
        const newPostRef = push(postsRef);
        await set(newPostRef, postData);
        
        alert('تم نشر المنشور بنجاح!');
        resetForm();
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Error publishing post:', error);
        alert('حدث خطأ أثناء نشر المنشور. يرجى المحاولة مرة أخرى.');
    } finally {
        hideLoading();
    }
});

// تعديل دالة رفع الصورة
async function uploadImage(file, userId, fileName) {
    return new Promise((resolve, reject) => {
        const storagePath = `posts/${userId}/${fileName}`;
        const imageRef = storageRef(storage, storagePath);
        const uploadTask = uploadBytesResumable(imageRef, file);
        
        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                uploadProgress.style.width = progress + '%';
            },
            (error) => {
                console.error('Upload error:', error);
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
    loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
    loadingOverlay.classList.add('hidden');
    uploadProgress.style.width = '0%';
}
