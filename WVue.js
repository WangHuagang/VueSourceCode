String.prototype.startWith=function(str){ 
    if(str==null||str==""||this.length==0||str.length>this.length) 
     return false; 
    if(this.substr(0,str.length)==str) 
      return true; 
    else
      return false; 
    return true; 
}
class Watcher {
    constructor(expr, vm, cb) {
        this.expr = expr;
        this.vm = vm;
        this.cb = cb;
        this.oldValue = this.getOldValue();
    }
    getOldValue() {
        // 在利用getValue获取数据调用getter()方法时先把当前观察者挂载
        Dep.target = this;
        const oldValue = compileUtil.getValue(this.expr, this.vm);
        // 挂载完毕需要注销，防止重复挂载 (数据一更新就会挂载)
        Dep.target = null;
        return oldValue;
    }
    // 通过回调函数更新数据
    update() {
        const newVal = compileUtil.getValue(this.expr, this.vm);
        if(newVal !== this.oldValue) {
            this.cb(newVal)
        }
    }
}


// Dep类存储watcher对象，并在数据变化时通知watcher
class Dep {
    constructor() {
        this.watcherCollector = [];
    }
    // 添加watcher
    addWatcher(watcher) {
        this.watcherCollector.push(watcher)
    }
    // 数据变化时通知watcher更新视图
    notify() {
        this.watcherCollector.forEach(w=>w.update())
    }
}

class Observer {
    constructor(data) {
        this.observe(data)
    }
    // data是一个对象，可能存在嵌套对象，所以需要使用递归遍历的方式进行观察者绑定
    observe(data) {
        if(data && typeof data === 'object') {
            Object.keys(data).forEach(key => {
                this.defineReactive(data,key,data[key])
            })
        }
    }
    // 通过 object.defineProperty方法对对象属性进行劫持
    defineReactive(obj,key,value) {
        // 递归观察value是否是对象，还需要继续观察
        this.observe(value)
        const dep = new Dep()
        Object.defineProperty(obj, key, {
            enumerable: true,
            configurable: false,
            get: () => {
                // 订阅数据变化时，往Dep中添加观察者
                Dep.target && dep.addWatcher(Dep.target)
                return value;
            },
            set: (newVal) => {
                if(value !== newVal) {
                    value = newVal
                    // 通知watcher数据发生改变
                    dep.notify();
                }
            }
        })
    }
}

const compileUtil = {
    getValue(expr, vm) {
        // 处理 person.name 这种对象类型，取出真正的value
        return expr.split('.').reduce((data, currentVal) => {
            return data[currentVal];
        }, vm.$data)
    },
    setVal(expr, vm, inputValue){
        const exprs = expr.split('.'), len = exprs.length;
        exprs.reduce((data,currentVal, idx)=>{
            if(idx===len-1){
                data[currentVal] = inputValue;
            }else{
                return data[currentVal]
            }
        }, vm.$data)
    },
    getContent(expr, vm){
        // {{person.name}}--{{person.age}}
        // 防止修改person.name使得所有值全部被替换
        return expr.replace(/\{\{(.+?)\}\}/g, (...args)=>{
            return this.getValue(args[1], vm);
        });
    },
    text(node, expr, vm) {
        let value;
        if(expr.indexOf('{{')!==-1){
            value = expr.replace(/\{\{(.+?)\}\}/g, (...args)=>{
                // // text的 Watcher应在此绑定，因为是对插值{{}}进行双向绑定
                // // Watcher的构造函数的 getOldVal()方法需要接受数据或者对象，而{{person.name}}不能接收
                new Watcher(args[1], vm, ()=>{
                    this.updater.textUpdater(node, this.getContent(expr, vm));
                });
                return this.getValue(args[1], vm);
            });
        }else{
            value = this.getValue(expr, vm);
        }
        this.updater.textUpdater(node, value)
    },
    html(node, expr, vm) {
        let value = this.getValue(expr, vm);
        new Watcher(expr, vm, (newValue) => {
            this.updater.htmlUpdater(node,newValue)
        })
        this.updater.htmlUpdater(node,value)
    },
    model(node, expr, vm) {
        const value = this.getValue(expr, vm);
        // v-model绑定对应的watcher，数据=>视图
        new Watcher(expr, vm, (newValue) => {
            this.updater.modelUpdater(node,newValue)
        })
        // 视图=>数据=>视图
        node.addEventListener('input',(e)=> {
            this.setVal(expr, vm, e.target.value)
        })
        this.updater.modelUpdater(node, value);
    },
    on(node, expr, vm, detailStr) {
        let fn = vm.$options.methods && vm.$options.methods[expr].bind(vm);
        node.addEventListener(detailStr,fn, false);
    },
    bind(node, expr, vm, detailStr){
        // v-on:href='...' => href='...'
        node.setAttribute(detailStr, expr);
    },
    // 视图更新函数对象
    updater: {
        textUpdater(node, value) {
            node.textContent = value;
        },
        htmlUpdater(node, value) {
            node.innerHTML = value;
        },
        modelUpdater(node, value){
            node.value = value;
        }
    }
}

// 编译HTML模板
class Compiler {
    constructor(el, vm) {
        this.el = this.isElementNode(el) ? el : document.getElementById(el);
        this.vm = vm;
        // 将预编译的元素节点放入文档碎片对象中，避免DOM频繁的回流与重绘，提高渲染性能
        const fragments = this.node2fragments(this.el);
        // 编译模板
        this.compile(fragments)
        // 追加子元素到根元素
        this.el.appendChild(fragments);
    }
    compile(fragments) {
        const childNodes = fragments.childNodes;
        Array.from(childNodes).forEach(child => {
            if(this.isElementNode(child)) {
                // 元素节点
                // console.log('元素节点',child)
                this.compileElement(child)
            }else {
                // 文本节点
                // console.log('文本节点',child)
                this.compileText(child);
            }
            //递归遍历 , 确保每一个子节点都能够编译到
            if(child.childNodes && child.childNodes.length){
                this.compile(child);
            }
        })
    }
    compileText(node) {
        // 编译{{person.name}}
        const content = node.textContent;
        if(/\{\{(.+?)\}\}/.test(content)) {
            compileUtil['text'](node, content, this.vm)
        }
    }
    compileElement(node) {
        let attributes = node.attributes;
        Array.from(attributes).forEach(attr => {
            const {name, value} = attr;
            if(this.isDirector(name)) { // v-text  v-html  v-mode  v-bind  v-on:click v-bind:href=''
                const [,directive] = name.split('-');
                const [compileKey, detailStr] = directive.split(':');
                // 更新数据  数据驱动视图更新
                compileUtil[compileKey](node, value, this.vm, detailStr)
                // 删除所有有指令的标签属性，即以“v-”开头的属性
                node.removeAttribute(name)
            }else if(this.isEventName(name)) {
                // 如果是事件处理 @click='handleClick'
                let [, detailStr] = name.split('@');
                compileUtil['on'](node, value, this.vm, detailStr);
                node.removeAttribute('@' + detailStr);
            }
        })
    }
    isEventName(attrName) {
        // 判断是否@开头
        return attrName.startsWith('@');
    }
    // 判断是否是vue的特性属性标签
    isDirector(attrName) {
        return attrName.startWith('v-')
    }
    node2fragments(el) {
        const f = document.createDocumentFragment();
        let firstChild;
        while (firstChild = el.firstChild) {
            f.appendChild(firstChild);
        }
        return f;
    }
    isElementNode(node) {
        // 元素节点的nodeType属性为 1
        return node.nodeType === 1;
    }
}

class WVue {
    constructor(options) {
        this.$el = options.el;
        this.$data = options.data;
        this.$options = options;
        if(this.$el) {
            //创建观察者
            new Observer(this.$data)
            // 编译模板指令
            new Compiler(this.$el, this)
            // 通过数据代理实现 this.person.name = 'whg'功能，而不是this.$data.person.name = 'whg'
            this.proxyData(this.$data);
        }
    }
    // 使用vm代理vm.$data
    proxyData(data) {
        for(let key in data) {
            Object.defineProperty(this,key, {
                get: () => {
                    return data[key]
                },
                set: (newVal)=> {
                    data[key] = newVal
                }
            })
        }
    }
}